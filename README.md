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
accb1fdea4aa5a112e7a9cd702d0cef1ea84b4f683cd0b2dd58051059cf7da11
```

To test it out you can use hypertail

```
hypertail /tmp/npm-to-hypercore accb1fdea4aa5a112e7a9cd702d0cef1ea84b4f683cd0b2dd58051059cf7da11
```

## License

MIT
