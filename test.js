const Topic = require('./index.js')


function accumulator() {
  const calls = [],
        func  = (p, meta, path) => calls.push(path)

  func.value = () => calls
  
  return func
}

test('It should subscribe and receive messages', () => {

  const accu  = accumulator(),
        topic = Topic()

  topic('foo')
    .subscribe(accu)
    .publishSync('hello')
    .publishSync('world')

  expect(accu.value()).toEqual(['foo','foo'])
})


test('It should publish to the topic then to all parent topics', () => {

  const accu  = accumulator(),
        topic = Topic()

  topic('foo')
    .subscribe(accu)
    .subtopic('bar')

  topic('foo.bar')
    .subscribe(accu)

  topic('foo.bar.baz')
    .subscribe(accu)
    .publishSync('hello')
    .publishSync('world')

  expect(accu.value()).toEqual([
    'foo.bar.baz', 'foo.bar', 'foo',
    'foo.bar.baz', 'foo.bar', 'foo',
  ])
})

test('It should not publish to subtopics', () => {

  const accu  = accumulator(),
        topic = Topic()

  topic('foo')
    .subscribe(accu)
    .subtopic('bar')
      .subscribe(accu)
      .subtopic('baz')
        .subscribe(accu)

  topic('foo')
    .publishSync('x')
    .subtopic('bar')
      .publishSync('y')
      .subtopic('baz')
        .publishSync('z')


  expect(accu.value()).toEqual([
    'foo', 
    'foo.bar','foo',
    'foo.bar.baz','foo.bar','foo'
  ])
})

test('It should publish asynchronously to the topic and all parent topics', done => {

  const accu  = accumulator(),
        accu2 = accumulator(),
        topic = Topic()

  topic('foo')
    .subscribe(accu)

  topic('foo.bar')
    .subscribe(accu)

  topic('foo.bar.baz')
    .subscribe(accu)
    .once(accu2)
    .publishAsync('hello')
    .publishAsync('world')

  setTimeout(() => {
    expect(accu.value()).toEqual([
      'foo.bar.baz', 'foo.bar', 'foo',
      'foo.bar.baz', 'foo.bar', 'foo',
    ])
    expect(accu2.value()).toEqual([
      'foo.bar.baz'
    ])
    done()
  }, 500)

  expect(accu.value()).toEqual([])
})



test('It should publish according to the async argument', done => {
  
  const accu  = accumulator(),
        topic = Topic()

  topic('foo')
    .subscribe(accu)
    .publish('hello', false)
    .publish('world', true)
    .publish('foo')

  expect(accu.value()).toEqual(['foo'])

  setTimeout(() => {
    expect(accu.value()).toEqual(['foo','foo','foo'])
    done()
  }, 200)
})


test('It should unsubscribe only the specified callback', () => {

  const accu1 = accumulator(),
        accu2 = accumulator(),
        topic = Topic()

  topic('foo')
    .subscribe(accu1)
    .subscribe(accu2)
    .publishSync('x')
    .unsubscribe(accu2)
    .publishSync('y')

  expect(accu1.value()).toEqual(['foo','foo'])
  expect(accu2.value()).toEqual(['foo'])
})

test('It should unsubscribe only the specified once-callback', () => {

  const accu1 = accumulator(),
        accu2 = accumulator(),
        topic  = Topic()

  topic('foo')
    .once(accu1)
    .once(accu2)
    .unsubscribe(accu2)
    .publishSync('x')
    .publishSync('y')

  expect(accu1.value()).toEqual(['foo'])
  expect(accu2.value()).toEqual([])
})



test('It should unsubscribe all callbacks', () => {

  const accu1 = accumulator(),
        accu2 = accumulator()
        topic = Topic()

  topic('foo')
    .subscribe(accu1)
    .once(accu2)
    .unsubscribe()
    .publishSync('x')

  expect(accu1.value()).toEqual([])
  expect(accu2.value()).toEqual([])
})


test('It should clear all subscriptions recursively', () => {

  const accu  = accumulator(),
        topic = Topic()

  const topicFooBarBaz = 
    topic('foo')
      .subscribe(accu)
      .subtopic('bar')
        .subscribe(accu)
      .subtopic('baz')
        .subscribe(accu)
        .publishSync('x')

  expect(accu.value()).toEqual(['foo.bar.baz','foo.bar','foo'])

  topic.clear()
  topicFooBarBaz.publishSync('y')

  expect(accu.value()).toEqual(['foo.bar.baz','foo.bar','foo'])
})

test('It should receive only one message', () => {

  const accu = accumulator(),
        topic = Topic()

  topic('foo')
    .once(accu)
    .publishSync('hello')
    .publishSync('world')

  expect(accu.value()).toEqual(['foo'])
})


test('It should return the parent topic or root topic', () => {

  const topic = Topic()

  const topicRoot = topic.pop()

  const topicFoo = 
    topic('foo.bar').pop()    

  expect(topicRoot.path).toBe('')
  expect(topicFoo.path).toBe('foo')
})

test('It should use the middleware on the topic and subtopics', () => {

  const wareCalls = [],
        ware1 = (message, meta, next) => (wareCalls.push(1), next(message, meta)),
        ware2 = (message, meta, next) => (wareCalls.push(2), next(message, meta)),
        topic = Topic()

  topic
    .use(ware1, ware2)
    .publishSync('x')
    .subtopic('foo')
      .publishSync('y')

  expect(wareCalls).toEqual([1,2,1,2])
})


test('It should not apply suptopic middleware', () => {

  const wareCalls = [],
        ware1 = (message, meta, next) => (wareCalls.push(1), next(message, meta)),
        ware2 = (message, meta, next) => (wareCalls.push(2), next(message, meta)),
        topic = Topic()

  topic
    .use(ware1)
    .subtopic('foo')
      .use(ware2)
      .publishSync('y')
      .pop()
    .publishSync('x')

  expect(wareCalls).toEqual([1,2,1])
})


test('It should remove the specified middleware and still apply subtopic middleware', () => {

  const wareCalls = [],
        ware1 = (message, meta, next) => (message+='*', wareCalls.push(message), next(message, meta)),
        ware2 = (message, meta, next) => (message+='*', wareCalls.push(message), next(message, meta)),
        topic = Topic()

  topic
    .use(ware1)
    .subtopic('foo')
      .use(ware2)
      .publishSync('x')
      .pop()
    .unuse(ware1)
    .subtopic('foo')
      .publishSync('y')


  expect(wareCalls).toEqual(['x*','x**','y*'])
})


test('It should only remove the specified middleware and leave other topic middleware in place', () => {

  const wareCalls = [],
        ware1 = (message, meta, next) => (message+='*', wareCalls.push(message), next(message, meta)),
        ware2 = (message, meta, next) => (message+='*', wareCalls.push(message), next(message, meta)),
        topic = Topic()

  topic
    .use(ware1)
    .use(ware2)
    .unuse(ware1)
    .subtopic('foo')
    .publishSync('x')


  expect(wareCalls).toEqual(['x*'])
})
