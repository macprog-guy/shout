'use strict'

/* global module */
module.exports = Topic

function Topic() {
  return makeContext('').topic
}

// Makes a new PRIVATE context 
function makeContext(name, parent) {

  const path = parent && parent.path? parent.path + '.' + name : name

  const context = {    
    parent,
    path,
    subscriptions: [],
    once:[],
    children: {},
    wares:[],
    middleware: undefined,
    counter:1
  }

  context.recomputeMiddlewareSubtree = recomputeMiddlewareSubtree.bind(context)
  context.composeMiddleware = composeMiddleware.bind(context)
  context.post = post.bind(context)

  context.topic = makeTopic(context,path)

  context.recomputeMiddlewareSubtree()
 
  return context
}

// Make a new PUBLIC topic (this is our API)
function makeTopic(context, path) {

  function topic(name) {

    // If no name is provided then return self
    if (!name) return topic

    // Take the "head" of the topic
    const 
      i    = name.indexOf('.'),
      head = i >= 0? name.substr(0,i) : name,
      rest = i >= 0? name.substr(i+1) : ''

    // Create the topic if it does not exist
    let child = context.children[head]
    if (!child)
      child = context.children[head] = makeContext(head, context)

    // Return the child topic
    return child.topic(rest)
  }

  topic.path        = path
  topic.subscribe   = subscribe.bind(context)
  topic.once        = subscribeOnce.bind(context)
  topic.publish     = publish.bind(context)
  topic.unsubscribe = unsubscribe.bind(context)
  topic.subtopic    = subtopic.bind(context)
  topic.clear       = clear.bind(context)
  topic.pop         = pop.bind(context)
  topic.use         = use.bind(context)
  topic.unuse       = unuse.bind(context)

  return topic
}


// Recomputes the middleware and that of child topics
// After the addition of a new middleware
function recomputeMiddlewareSubtree(wares) {
  
  // Collect wares from parents if not specified
  if (wares === undefined) {
    wares = []
    let context = this.parent
    while (context) {
      wares.unshift(...context.wares)
      context = context.parent
    }
  }

  wares = wares.concat(this.wares)

  this.middleware = this.composeMiddleware(wares)

  for (let child of Object.values(this.children))
    child.recomputeMiddlewareSubtree(wares)

  return this.topic
}


// Composes parent and child middlewares into a single function
function composeMiddleware(wares) {

  let 
    f = (message, meta) => this.post(message, meta),
    n = wares.length
      
  for (let i=0;  i<n;  i++) {
    const 
      ware = wares[n-i-1],
      next = f
    f = (message, meta) => ware(message, meta, next)
  }

  return f
}


// Actually calls the subscriptions
function post(payload, meta) {

  let context = this

  while (context) {

    for (let callback of context.once) {
      meta.path = context.path
      callback(payload, meta)    
    }
    
    for (let callback of context.subscriptions) {
      meta.path = context.path
      callback(payload, meta)
    }

    context.once = []
    context = context.parent
  }
  return this.topic
}





//
// PUBLIC API
//

// Returns the subtopic
function subtopic(subtopic) {
  return this.topic(subtopic)
}


// Returns the parent topic
function pop() {
  return this.parent && this.parent.topic
}


// Registers one or more callbacks for this topic
// Callback signature is (payload, meta) => { ... }
function subscribe(...callbacks) {
  this.subscriptions.push(...callbacks)
  return this.topic
}

// Registers only for the next message on this topic
// Callback signature is (payload, meta) => { ... }
function subscribeOnce(...callbacks) {
  this.once.push(...callbacks)
  return this.topic
}


// Publish a message on this topic
function publish(payload) {
  const meta = {
    contextId:    this.counter++,
    originalPath: this.path
  }
  this.middleware(payload, meta)
  return this.topic
}

// Add a middleware function to this topic (and subtocics)
// Middleware signature is (payload, meta, next) => { ... }
function use(...middlewares) {
  
  // Add the middleware functions to the list
  this.wares.push(...middlewares)
  this.recomputeMiddlewareSubtree()

  return this.topic
}

// Removes a middleware function from this topic (and subtocics)
function unuse(...middlewares) {

  const without = []
  
  for (let ware of this.wares) {
    if (!middlewares.includes(ware))
      without.push(ware)
  }
  
  this.wares = without
  this.recomputeMiddlewareSubtree()

  return this.topic
}


// Unsubscribes one, more or all callbacks from a topic
function unsubscribe(...callbacks) {

  if (callbacks.length === 0) {
    this.subscriptions = []
    this.once = []
  } else {

    const 
      subs_without = [],
      once_without = []

    for (let cb of this.subscriptions) {
      if (!callbacks.includes(cb))
        subs_without.push(cb)
    }

    for (let cb of this.once) {
      if (!callbacks.includes(cb))
        once_without.push(cb)
    }

    this.subscriptions = subs_without
    this.once = once_without
  }
  return this.topic
}

// Unsubscribes all callbacks from the topic and its subtopics
function clear() {
  this.topic.unsubscribe()
  for (let child of Object.values(this.children))
    child.topic.clear()
  return this.topic
}