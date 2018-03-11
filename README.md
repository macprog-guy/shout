# Subcast 
A fast, small and dependency free publish subscribe event-bus for the browser and nodejs.

## Key features
* fast! really!
* middleware per topic or subtopic
* nested topics using dot notation
* chainable function calls
* no dependencies
* unit tests & 100% coverage

# How fast?
```
Platform info:
==============
   Darwin 17.2.0 x64
   Node.JS: 9.5.0
   V8: 6.2.414.46-node.18
   Intel(R) Core(TM) i7-4850HQ CPU @ 2.30GHz × 8

Suite: Synchronous cases
✔ Direct observer callback                                                        82,763,345 rps
✔ Publish to the root topic with one subscriber                                   33,304,908 rps
✔ Publish to a nested topic with one subscriber                                   19,653,191 rps
✔ Publish to a nested topic with subscribers on topic chain                        8,622,035 rps
✔ Publish to a nested topic with subscribers and middleware on topic chain         8,557,189 rps

Suite: Asynchronous cases
✔ Direct observer callback                                                         3,495,022 rps
✔ Publish to the root topic with one subscriber                                    2,768,843 rps
✔ Publish to a nested topic with one subscriber                                    2,654,318 rps
✔ Publish to a nested topic with subscribers on topic chain                        2,283,484 rps
✔ Publish to a nested topic with subscribers and middleware on topic chain         2,300,750 rps
```

# How small?
About 2 KB compressed.


## Installation
You can install it via [NPM](http://npmjs.org/).
```
$ npm install subcast --save
```
or 
```
$ yarn add subcast
```

## Example Usage

```js
const topics = require('subcast')()

topics('foo')
  .subscribe(console.log)
  .publish('Hello World!')
  .publish('Hello again')
  .unsubscribe()

topics('foo')
  .use((message, meta, next) => { 
    console.log('foo:', message)
    next(message, meta)
  })
  .subtopic('bar')
  .use((message, meta, next) => {
    console.log('bar:', message)
    next(message, meta)
  })
  .publish('hello') // bar: hello
  .pop()
  .publish('hello') // foo: hello + bar: hello
  .clear()

topics('some-topic')
  .once(console.log)
  .publish('hello')   // hello
  .publish('goodbye') // no output

```


## `Subcast`
Constructor for accessing topics, which are created on the fly if necessary.
Topics can be nested and each have their own list of subscribers and middleware.

```js
// Creates three nested topics each with it's list of subscribers and middleware.
const fooBarBazTopic = topics('foo.bar.baz')

// A subscription to the root topic will get called for all published messages.
const rootTopic = topics()
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`name`   | `undefined` | if `undefined` returns the current topic otherwise creates nested topics using `.` as the seperator.




## `subscribe`
Registers one or more callbacks with the topic and returns the topic.
The callback will be called for publications on this topic as well as all subtopics.

```js
// Creates three nested topics each with it's list of subscribers and middleware.
topics('foo.bar.baz')
  .subscribe((message, meta, path) => { /* do something  */ })
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`callback`   |  | `(message, meta) => { /* ... */ }` the callback gets the published message as well as a meta object that contains a unique `contextId`, the `originalPath` on which the message was published. Other properties may also have been added by middleware functions.



## `once`
Similar to subscribe but will automatically unsubscribe after having received the next message.

```js
// Creates three nested topics each with it's list of subscribers and middleware.
topics('foo.bar.baz')
  .subscribeOnce((message, meta, path) => { /* do something  */ })
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`callback`   |  | See `subscribe`



## `publishSync`
Publishes a message synchronously to a topic and all it's parent topics.

The function returns the topic and upon return all subscribers will have
received the message.
```js
// Creates three nested topics each with it's list of subscribers and middleware.
topics('foo.bar.baz')
  .publishSync({cmd:'do-this', with:'that'})
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`message`   | `Any` | The message get posted as-is unless modified by middleware functions


## `publishAsync`
Publishes a message asynchronously to a topic and all it's parent topics.

The function returns the topic subscribers will have not have received the message.
The messages will be received during the next event loop.
```js
// Creates three nested topics each with it's list of subscribers and middleware.
topics('foo.bar.baz')
  .publishAsync({cmd:'do-this', with:'that'})
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`message`   | `Any` | The message get posted as-is unless modified by middleware functions




## `unsubscribe`
Unregisters one or more callbacks from the topic. If no arguments are provided then all 
subscribers are unregistered.

```js
// Creates three nested topics each with it's list of subscribers and middleware.
topics('foo.bar.baz')
  .unsubscribe(fooBarBazMessageHandler1, fooBarBazMessageHandler2)
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`callbacks`   |  | If `undefined` will unsubscribe all subscribers from the topic otherwise only those that were specified.


## `clear`
Unregisters all callers from a topic and its subtopics. Calling this on the root topic will clear
all subscripitions.

```js
// Creates three nested topics each with it's list of subscribers and middleware.
topics('foo.bar.baz')
  .clear()
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
   |  | If `undefined` will unsubscribe all subscribers otherwise only those listed in the callback list.



## `subtopic`
From an existing topic, returns a subtopic with the given name

```js
// Creates three nested topics each with it's list of subscribers and middleware.
// This is equivalent to topics('foo.bar.baz')
topics('foo')
  .subtopic('bar')
    .subtopic('baz')
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`name`   |  | If `undefined` will return the current topic otherwise will create nested topics as necessary and return the requested one.


## `pop`
Returns the parent topic or the root topic if no parent exists.

```js
topics('foo')
  .subtopic('bar')
  .pop()  
```



## `use`
Registers a middleware function with a topic. It will be applied to messages for this topic and all subtopics.
Middleware functions get called in the order that they are added and from parent to child.

```js
// Creates three nested topics each with it's list of subscribers and middleware.
topics('foo')
  .use((message, meta, next) =>{ 
     // Do something...
     next(message, meta)
     // Do something else...
  })
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`callbacks`  |  | One or more functions with the `(message, meta, next) => { ... }` signature. Please note that if `next` is not called then the message won't be published.




## `use`
Unregisters a middleware function from the topic. 

```js
// Creates three nested topics each with it's list of subscribers and middleware.
topics('foo')
  .unuse(myMiddleware)
```
### Arguments
Parameter | Default     | Description
-------- | ----------- | -----------
`callbacks`  |  | One or more functions to remove from the middleware chain.





## Contribution
Please send pull requests improving the usage and fixing bugs, improving documentation and providing better examples, or providing some testing, because these things are important.

## License
topics is available under the [MIT license](https://tldrlegal.com/license/mit-license).

