# npm-to-hypercore

A simple data fetcher that streams all changes made to npm and stores
them in Hypercore. The changes are stored such that each version of a
package that's released is one block in Hypercore.

[![Build status](https://travis-ci.org/watson/npm-to-hypercore.svg?branch=master)](https://travis-ci.org/watson/npm-to-hypercore)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Installation

```
npm install npm-to-hypercore -g
```

## Usage

```
npm-to-hypercore [db]
```

Just run the `npm-to-hypercore` command. Takes an optional `db` argument
to use as the path to the database.

## Try it out

We have an instance of this running already. You can replicate data from it by using this hypercore key

```
f5d045813912dadbff4bdc8a43bb78da6685f965f1a88e430db49c793a5a1a01
```

To test it out you can use hypertail

```
hypertail /tmp/npm-to-hypercore f5d045813912dadbff4bdc8a43bb78da6685f965f1a88e430db49c793a5a1a01
```

## License

MIT
