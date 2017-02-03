'use strict'

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

var normalize = through2.obj(function (change, env, cb) {
  var stream = this
  var doc = clean(change.doc)
  var next = afterAll(cb)

  if (!doc) {
    console.log('skipping %s - invalid document', change.id)
  } else if (!doc.versions || doc.versions.length === 0) {
    console.log('skipping %s - no versions detected', change.id)
  } else {
    Object.keys(doc.versions).forEach(function (version) {
      var key = doc.name + '@' + version
      var done = next()
      index.get(key, function (err, value) {
        if (!err || !err.notFound) return done(err)
        stream.push(doc.versions[version])
        index.put(key, true, done)
      })
    })
  }
})

var db = levelup(process.argv[2] || './npm-to-hypercore.db')
var core = hypercore(sub(db, 'core'))
var index = sub(db, 'index')

core.list(function (err, keys) {
  if (err) throw err

  var feed = core.createFeed(keys[0])

  console.log('hypercore key:', feed.key.toString('hex'))

  swarm(feed)

  feed.open(run)

  function run (err) {
    if (err) throw err

    var stream = feed.createWriteStream()

    if (feed.blocks === 0) {
      pump(changesSinceStream(), normalize, ndjson.serialize(), stream, run)
    } else {
      feed.get(feed.blocks - 1, function (err, block) {
        if (err) throw err
        var seq = JSON.parse(block).seq
        pump(changesSinceStream(seq), normalize, ndjson.serialize(), stream, run)
      })
    }
  }
})

function changesSinceStream (seq) {
  seq = seq || 0

  console.log('feching changes since sequence #%s', seq)

  return new ChangesStream({
    db: 'https://replicate.npmjs.com',
    include_docs: true,
    since: seq,
    highWaterMark: 4 // reduce memory - default is 16
  })
}
