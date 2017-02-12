'use strict'

var path = require('path')
var mkdirp = require('mkdirp')
var ChangesStream = require('changes-stream')
var clean = require('normalize-registry-metadata')
var through2 = require('through2')
var hypercore = require('hypercore')
var swarm = require('hyperdrive-archive-swarm')
var pump = require('pump')
var level = require('level')

var dbRoot = process.argv[2] || path.join('.', 'npm-to-hypercore.db')
console.log('db location: %s', path.resolve(dbRoot))
mkdirp(dbRoot)

var feed = hypercore(path.join(dbRoot, 'hypercore'), {valueEncoding: 'json'})
var db = level(path.join(dbRoot, 'index'))
var normalize = through2.obj(transform)

feed.ready(function () {
  console.log('hypercore key:', feed.key.toString('hex'))
  swarm(feed)
  run()
})

function run (err) {
  if (err) throw err
  recoverFromBadShutdown(function (err) {
    if (err) throw err
    getNextSeqNo(function (err, seq) {
      if (err) throw err
      console.log('feching changes since sequence #%s', seq)
      pump(changesSinceStream(seq), normalize, run)
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
    db.put('!latest_seq!', change.seq, cb)
  }

  function processVersion (err) {
    if (err) return done(err)
    var version = versions.shift()
    if (!version) return done()
    var key = change.id + '@' + version
    db.get(key, function (err) {
      if (!err || !err.notFound) return processVersion(err)
      feed.append(doc.versions[version], function (err) {
        if (err) return done(err)
        if (feed.length % 1000 === 0) console.log('appended %d blocks (seq: %s, modified: %s)', feed.length, seq, modified)
        db.put(key, true, processVersion)
      })
    })
  }
}

function getNextSeqNo (cb) {
  db.get('!latest_seq!', function (err, seq) {
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

  function recover (index) {
    if (index === undefined) index = feed.length - 1
    if (index === -1) return done()
    feed.get(index, function (err, pkg) {
      if (err) return done(err)
      var key = pkg.name + '@' + pkg.version
      db.get(key, function (err) {
        if (!err || !err.notFound) return done(err)
        console.log('warning: block %d (%s) not indexed - recovering...', index, key)
        db.put(key, true, function (err) {
          if (err) return done(err)
          recover(index - 1)
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
