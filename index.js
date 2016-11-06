'use strict'

var ChangesStream = require('changes-stream')
var hypercore = require('hypercore')
var swarm = require('hyperdrive-archive-swarm')
var ndjson = require('ndjson')
var pump = require('pump')
var levelup = require('level')

var db = levelup('./db')
var core = hypercore(db)

core.list(function (err, keys) {
  if (err) throw err

  var feed = core.createFeed(keys[0])

  console.log('hypercore key:', feed.key.toString('hex'))

  swarm(feed)

  feed.open(run)

  function run (run) {
    if (err) throw err

    var stream = feed.createWriteStream()

    if (feed.blocks === 0) {
      pump(changesSinceStream(), stream, run)
    } else {
      feed.get(feed.blocks - 1, function (err, block) {
        if (err) throw err
        var seq = JSON.parse(block).seq
        pump(changesSinceStream(seq), stream, run)
      })
    }
  }
})

function changesSinceStream (seq) {
  seq = seq || 0

  console.log('feching changes since sequence #%s', seq)

  var changes = new ChangesStream({
    db: 'https://replicate.npmjs.com',
    include_docs: true,
    since: seq,
    highWaterMark: 4 // reduce memory - default is 16
  })

  return changes.pipe(ndjson.serialize())
}
