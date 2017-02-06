'use strict'

var path = require('path')
var ChangesStream = require('changes-stream')
var clean = require('normalize-registry-metadata')
var through2 = require('through2')
var hypercore = require('hypercore')
var swarm = require('hyperdrive-archive-swarm')
var ndjson = require('ndjson')
var pump = require('pump')
var afterAll = require('after-all')
var levelup = require('level')
var sub = require('subleveldown')

var dbPath = process.argv[2] || './npm-to-hypercore.db'
console.log('db location: %s', path.resolve(dbPath))

var db = levelup(dbPath)
var core = hypercore(sub(db, 'core'))
var index = sub(db, 'index')
var normalize = through2.obj(transform)
var block = 0

core.list(function (err, keys) {
  if (err) throw err

  var feed = core.createFeed(keys[0])

  console.log('hypercore key:', feed.key.toString('hex'))

  swarm(feed)

  feed.open(run)

  function run (err) {
    if (err) throw err

    var stream = feed.createWriteStream()

    index.get('!latest_seq!', function (err, value) {
      var seq = value || 0
      if (err && !err.notFound) throw err
      pump(changesSinceStream(seq), normalize, ndjson.serialize(), stream, run)
    })
  }
})

function changesSinceStream (seq) {
  console.log('feching changes since sequence #%s', seq)

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
  var next = afterAll(function (err) {
    if (err) return cb(err)
    index.put('!latest_seq!', change.seq, cb)
  })

  clean(doc)

  var ts = doc && doc.time && doc.time.modified
  var seq = change.seq

  if (!doc) {
    console.log('[%s] skipping %s - invalid document', seq, change.id)
  } else if (!doc.versions || doc.versions.length === 0) {
    console.log('[%s - %s] skipping %s - no versions detected', ts, seq, change.id)
  } else {
    Object.keys(doc.versions).forEach(function (version) {
      var key = doc.name + '@' + version
      var done = next()
      index.get(key, function (err, value) {
        if (!err || !err.notFound) return done(err)
        stream.push(doc.versions[version])
        if (++block % 10000 === 0) console.log('[%s - %s] processed %d blocks since last restart', ts, seq, block)
        index.put(key, true, done)
      })
    })
  }
}
