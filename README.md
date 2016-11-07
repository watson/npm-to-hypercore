# npm-to-hypercore

A simple data fetcher that streams all changes made to npm and stores
them in Hypercore.

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
503cf9e12d8ae49a07568d90f04bbdbfa3f1998ab97ed2b5143c1f3f69ec052f
```

To test it out you can use hypertail

```
hypertail /tmp/npm-to-hypercore 503cf9e12d8ae49a07568d90f04bbdbfa3f1998ab97ed2b5143c1f3f69ec052f
```

## License

MIT
