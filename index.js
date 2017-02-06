'use strict'

var path = require('path')
var ChangesStream = require('changes-stream')
var clean = require('normalize-registry-metadata')
var through2 = require('through2')
var hypercore = require('hypercore')
var swarm = require('hyperdrive-archive-swarm')
var ndjson = require('ndjson')
var pump = require('pump')
var levelup = require('level')
var sub = require('subleveldown')

var dbPath = process.argv[2] || './npm-to-hypercore.db'
console.log('db location: %s', path.resolve(dbPath))

var db = levelup(dbPath)
var core = hypercore(sub(db, 'core'))
var index = sub(db, 'index')
var normalize = through2.obj(transform)
var feed, latestBlock

core.list(function (err, keys) {
  if (err) throw err
  feed = core.createFeed(keys[0])
  console.log('hypercore key:', feed.key.toString('hex'))
  swarm(feed)
  feed.open(run)
})

function run (err) {
  if (err) throw err
  latestBlock = feed.blocks

  recoverFromBadShutdown(function (err) {
    if (err) throw err

    var stream = feed.createWriteStream()

    getNextSeqNo(function (err, seq) {
      if (err) throw err
      console.log('feching changes since sequence #%s', seq)
      pump(changesSinceStream(seq), normalize, ndjson.serialize(), stream, run)
    })
  })
}

function changesSinceStream (seq) {
  return new ChangesStream({
    db: 'https://replicate.npmjs.com',
    include_docs: true,
    since: seq,
    highWaterMark: 4 // reduce memory - default is 16
  })
}

function transform (change, env, cb) {
  var stream = this
  var doc = change.doc

  clean(doc)

  var modified = doc && doc.time && doc.time.modified
  var seq = change.seq

  if (!doc) {
    console.log('skipping %s - invalid document (seq: %s)', change.id, seq)
    done()
    return
  } else if (!doc.versions || doc.versions.length === 0) {
    console.log('skipping %s - no versions detected (seq: %s, modified: %s)', change.id, seq, modified)
    done()
    return
  }

  var versions = Object.keys(doc.versions)
  processVersion()

  function done (err) {
    if (err) return cb(err)
    index.put('!latest_seq!', change.seq, cb)
  }

  function processVersion (err) {
    if (err) return done(err)
    var version = versions.shift()
    if (!version) return done()
    var key = change.id + '@' + version
    index.get(key, function (err) {
      if (!err || !err.notFound) return processVersion(err)
      stream.push(doc.versions[version])
      if (++latestBlock % 1000 === 0) console.log('pushed %d blocks (seq: %s, modified: %s)', latestBlock, seq, modified)
      index.put(key, true, processVersion)
    })
  }
}

function getNextSeqNo (cb) {
  index.get('!latest_seq!', function (err, seq) {
    if (err && err.notFound) cb(null, 0)
    else if (err) cb(err)
    else cb(null, parseInt(seq, 10) + 1)
  })
}

// This function expects that there's no gab in the index. So if it
// successfully locates key in the index there must no missing keys prior to
// that.
function recoverFromBadShutdown (cb) {
  console.log('validating index...')
  recover()

  function recover (block) {
    if (block === undefined) block = feed.blocks - 1
    if (block === -1) return done()
    feed.get(block, function (err, data) {
      if (err) return done(err)
      var pkg = JSON.parse(data)
      var key = pkg.name + '@' + pkg.version
      index.get(key, function (err) {
        if (!err || !err.notFound) return done(err)
        console.log('warning: block %d (%s) not indexed - recovering...', block, key)
        index.put(key, true, function (err) {
          if (err) return done(err)
          recover(block - 1)
        })
      })
    })
  }

  function done (err) {
    if (err) return cb(err)
    console.log('index is up to date')
    cb()
  }
}
