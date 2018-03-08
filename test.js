const Topic = require('./index.js')

function counter(payload, meta) {
  let counts = {},
      func   = (payload, meta) => counts[meta.path] = (counts[meta.path] || 0) + 1

  func.value = () => counts
  
  return func
}


test('It should subscribe and receive messages', () => {

  const count = counter(),
        topic = Topic()

  topic('foo')
    .subscribe(count)
    .publish('hello')
    .publish('world')

  expect(count.value()).toEqual({foo:2})
})

test('It should publish to all parent topics', () => {

  const count = counter(),
        topic = Topic()

  topic('foo')
    .subscribe(count)

  topic('foo.bar')
    .subscribe(count)

  topic('foo.bar.baz')
    .subscribe(count)
    .publish('hello')
    .publish('world')

  expect(count.value()).toEqual({
    'foo':2, 
    'foo.bar':2, 
    'foo.bar.baz':2
  })
})

test('It should not publish to subtopics', () => {

  const count = counter(),
        topic = Topic()

  topic('foo')
    .subscribe(count)
    .publish('x')
    .subtopic('bar')
    .subscribe(count)
    .publish('y')
    .subtopic('baz')
    .subscribe(count)
    .publish('z')

  expect(count.value()).toEqual({
    'foo':3, 
    'foo.bar':2, 
    'foo.bar.baz':1
  })
})


test('It should unsubscribe a callback', () => {

  const count = counter(),
        topic = Topic()

  topic('foo')
    .subscribe(count)
    .publish('x')
    .unsubscribe(count)
    .publish('y')

  expect(count.value()).toEqual({'foo':1})
})

test('It should unsubscribe all callbacks', () => {

  const count1 = counter(),
        count2 = counter()
        topic  = Topic()

  topic('foo')
    .subscribe(count1)
    .subscribe(count2)
    .publish('x')
    .unsubscribe()
    .publish('y')

  expect(count1.value()).toEqual({'foo':1})
  expect(count2.value()).toEqual({'foo':1})
})


test('It should clear all subscriptions recursively', () => {

  const count = counter(),
        topic = Topic()

  topic('foo')
    .subscribe(count)
    .subtopic('bar')
    .subscribe(count)
    .subtopic('baz')
    .subscribe(count)
    .publish('x')

  expect(count.value()).toEqual({'foo':1, 'foo.bar':1, 'foo.bar.baz':1})

  topic.clear()
  topic('foo.bar.baz').publish('y')

  expect(count.value()).toEqual({'foo':1, 'foo.bar':1, 'foo.bar.baz':1})
})

test('It should receive only one message', () => {

  const count = counter(),
        topic = Topic()

  topic('foo')
    .once(count)
    .publish('hello')
    .publish('world')

  expect(count.value()).toEqual({foo:1})
})


test('It should return the parent topic or root topic', () => {

  const count = counter(),
        topic = Topic()

  topic('foo.bar')
    .subscribe(count)
    .pop()    
    .publish('hello')

  expect(count.value()).toEqual({})
})

test('It should use the middleware on the topic and subtopics', () => {

  const wareCalls = [],
        ware1 = (message, meta, next) => (wareCalls.push(1), next(message, meta)),
        ware2 = (message, meta, next) => (wareCalls.push(2), next(message, meta))

  topic
    .use(ware1, ware2)
    .publish('x')
    .subtopic('foo')
    .publish('y')

  expect(wareCalls).toEqual([1,2,1,2])
})


test('It should not use subtopic middleware', () => {

  const wareCalls = [],
        ware1 = (message, meta, next) => (wareCalls.push(1), next(message, meta)),
        ware2 = (message, meta, next) => (wareCalls.push(2), next(message, meta))

  topic
    .use(ware1)
    .subtopic('foo')
    .use(ware2)
    .publish('y')
    //.pop()
    //.publish('x')

  expect(wareCalls).toEqual([1,2])
})
