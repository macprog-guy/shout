'use strict'

/* global module, setTimeout */
module.exports = Topic


function Topic() {
  return makeContext('').topic
}

// ----------------------------------------------------------------------------
//
// PRIVATE
//
// Creates the context to which all of the PUBLIC api functions are bound.
//
// It's simply where the state for each topic is store but in a way that's 
// not accessible from the public api.
//
// ----------------------------------------------------------------------------

function makeContext(name, parent) {

  const path = parent && parent.path? parent.path + '.' + name : name

  const context = {    
    parent,
    path,
    pending:[],
    subscriptions: [],
    once:[],
    hasOnce: false,
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

// ----------------------------------------------------------------------------
//
// PRIVATE
//
// Creates a new topic for a given path and binds the API function to its context.
//
// ----------------------------------------------------------------------------

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

  topic.path         = path
  topic.subscribe    = subscribe.bind(context)
  topic.once         = subscribeOnce.bind(context)
  topic.publishSync  = publishSync.bind(context)
  topic.publishAsync = publishAsync.bind(context)
  topic.publish      = publish.bind(context)
  topic.unsubscribe  = unsubscribe.bind(context)
  topic.subtopic     = subtopic.bind(context)
  topic.clear        = clear.bind(context)
  topic.pop          = pop.bind(context)
  topic.use          = use.bind(context)
  topic.unuse        = unuse.bind(context)

  Object.freeze(topic)

  return topic
}


// ----------------------------------------------------------------------------
//
// PRIVATE
//
// Recomputes the middleware function.
//
// The middleware chain for any topic is always precomputed so that when we 
// can post messages with as little overhead as possoble. This means that 
// whenever a topic or any of its parent topics registers a new middleware
// function, the middleware chain changes and the composite function must be
// recomputed. 
//
// This function is responsible for collecting the middleware functions for
// any given topic and navigating the topic hierarchy. The function composition
// is delegated to composeMiddleware.
//
// ----------------------------------------------------------------------------

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
}


// ----------------------------------------------------------------------------
//
// PRIVATE
//
// Computes a composite function chain that includes all calls to the middleware
// functions as well as the final call to the internal "post" function.
//
// The middleware functions are called in the order they are found in the 
// wares array.
//
// ----------------------------------------------------------------------------

function composeMiddleware(wares) {

  let 
    f = this.post,
    n = wares.length
      
  for (let i=0;  i<n;  i++) {
    const 
      ware = wares[n-i-1],
      next = f
    f = (message, meta) => ware(message, meta, next)
  }

  return f
}



// ----------------------------------------------------------------------------
//
// PRIVATE
//
// When the number of subscribers grows, we don't use function composition 
// anymore. Instead, we just loop through the subscribers and call each one 
// in turn. 
//
// ----------------------------------------------------------------------------

function post(payload, meta) {

  let context = this

  while (context) {
    
    const 
      parent = context.parent, 
      once   = context.once, 
      subs   = context.subscriptions,
      path   = context.path

    if (once.length) {
      const n1 = once.length
      for (let i=0;  i<n1;  i++)
        once[i](payload, meta, path)
      context.once = []
    }

    if (subs.length) {
      const n2 = subs.length
      for (let i=0;  i<n2;  i++)
        subs[i](payload, meta, path)
    }
    
    context = parent
  }
}




// ----------------------------------------------------------------------------
//
// PUBLIC API
//
// Returns a subtopic of the called topic. If the subtopic contains dots then
// it may return a nested subtopic (a sub-sub-sub... topic)
//
// ----------------------------------------------------------------------------

function subtopic(subtopic) {
  return this.topic(subtopic)
}


function pop() {
  return this.parent && this.parent.topic || this.topic
}

function subscribe(...callbacks) {  
  this.subscriptions.push(...callbacks)
  return this.topic
}

function subscribeOnce(...callbacks) {
  this.once.push(...callbacks)
  return this.topic
}

function publishAsync(payload) {
  
  const meta = {
    contextId:    this.counter++,
    originalPath: this.path,
    async:        true
  }

  this.pending.push([payload, meta])
  if (this.pending.length === 1) {
    setTimeout(() => {
      
      const pairs  = this.pending
      this.pending = []

      for (let i=0;  i<pairs.length;  i++) {
        const [p, m] = pairs[i]
        this.middleware(p, m)  
      }      
    }, 0)
  }

  return this.topic
}

function publishSync(payload) {
  const meta = {
    contextId:    this.counter++,
    originalPath: this.path,
    async:        false
  }
  this.middleware(payload, meta)
  return this.topic
}

function publish(payload, async=true) {
  return async? 
    this.topic.publishAsync(payload) :
    this.topic.publishSync(payload)
}

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

function clear() {
  this.topic.unsubscribe()
  for (let child of Object.values(this.children))
    child.topic.clear()
  return this.topic
}

function use(...middlewares) {
  this.wares.push(...middlewares)
  this.recomputeMiddlewareSubtree()
  return this.topic
}

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
