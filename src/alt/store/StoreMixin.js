import Symbol from 'es-symbol'

import * as Sym from '../symbols/symbols'
import * as fn from '../../utils/functions'

const StoreMixin = {
  waitFor(...sources) {
    if (!sources.length) {
      throw new ReferenceError('Dispatch tokens not provided')
    }

    let sourcesArray = sources
    if (sources.length === 1) {
      sourcesArray = Array.isArray(sources[0]) ? sources[0] : sources
    }

    const tokens = sourcesArray.map((source) => {
      return source.dispatchToken || source
    })

    this.dispatcher.waitFor(tokens)
  },

  exportAsync(asyncMethods) {
    this.registerAsync(asyncMethods)
  },

  registerAsync(asyncDef) {
    let loadCounter = 0

    const asyncMethods = fn.isFunction(asyncDef)
      ? asyncDef(this.alt)
      : asyncDef

    const toExport = Object.keys(asyncMethods).reduce((publicMethods, methodName) => {
      const desc = asyncMethods[methodName]
      const spec = fn.isFunction(desc) ? desc(this) : desc

      const validHandlers = ['success', 'error', 'loading']
      validHandlers.forEach((handler) => {
        if (spec[handler] && !spec[handler][Sym.ACTION_KEY]) {
          throw new Error(`${handler} handler must be an action function`)
        }
      })

      publicMethods[methodName] = (...args) => {
        const state = this.getInstance().getState()
        const value = spec.local && spec.local(state, ...args)
        const shouldFetch = spec.shouldFetch
          ? spec.shouldFetch(state, ...args)
          : value == null
        const intercept = spec.interceptResponse || (x => x)

        const makeActionHandler = (action, isError) => {
          return (x) => {
            const fire = () => {
              loadCounter -= 1
              action(intercept(x, action, args))
              if (isError) throw x
            }
            return typeof window === 'undefined' ? (() => fire()) : fire()
          }
        }

        // if we don't have it in cache then fetch it
        if (shouldFetch) {
          loadCounter += 1
          /* istanbul ignore else */
          if (spec.loading) spec.loading(intercept(null, spec.loading, args))
          return spec.remote(state, ...args)
            .catch(makeActionHandler(spec.error, 1))
            .then(makeActionHandler(spec.success))
        } else {
          // otherwise emit the change now
          this.emitChange()
        }
      }

      return publicMethods
    }, {})

    this.exportPublicMethods(toExport)
    this.exportPublicMethods({
      isLoading: () => loadCounter > 0
    })
  },

  exportPublicMethods(methods) {
    fn.eachObject((methodName, value) => {
      if (!fn.isFunction(value)) {
        throw new TypeError('exportPublicMethods expects a function')
      }

      this[Sym.PUBLIC_METHODS][methodName] = value
    }, [methods])
  },

  emitChange() {
    this.getInstance().emitChange()
  },

  on(lifecycleEvent, handler) {
    if (lifecycleEvent === 'error') {
      this[Sym.HANDLING_ERRORS] = true
    }
    this[Sym.LIFECYCLE].on(lifecycleEvent, handler.bind(this))
  },

  bindAction(symbol, handler) {
    if (!symbol) {
      throw new ReferenceError('Invalid action reference passed in')
    }
    if (!fn.isFunction(handler)) {
      throw new TypeError('bindAction expects a function')
    }

    if (handler.length > 1) {
      throw new TypeError(
        `Action handler in store ${this._storeName} for ` +
        `${(symbol[Sym.ACTION_KEY] || symbol).toString()} was defined with ` +
        `two parameters. Only a single parameter is passed through the ` +
        `dispatcher, did you mean to pass in an Object instead?`
      )
    }

    // You can pass in the constant or the function itself
    const key = symbol[Sym.ACTION_KEY] ? symbol[Sym.ACTION_KEY] : symbol
    this[Sym.LISTENERS][key] = handler.bind(this)
    this[Sym.ALL_LISTENERS].push(Symbol.keyFor(key))
  },

  bindActions(actions) {
    fn.eachObject((action, symbol) => {
      const matchFirstCharacter = /./
      const assumedEventHandler = action.replace(matchFirstCharacter, (x) => {
        return `on${x[0].toUpperCase()}`
      })
      let handler = null

      if (this[action] && this[assumedEventHandler]) {
        // If you have both action and onAction
        throw new ReferenceError(
          `You have multiple action handlers bound to an action: ` +
          `${action} and ${assumedEventHandler}`
        )
      } else if (this[action]) {
        // action
        handler = this[action]
      } else if (this[assumedEventHandler]) {
        // onAction
        handler = this[assumedEventHandler]
      }

      if (handler) {
        this.bindAction(symbol, handler)
      }
    }, [actions])
  },

  bindListeners(obj) {
    fn.eachObject((methodName, symbol) => {
      const listener = this[methodName]

      if (!listener) {
        throw new ReferenceError(
          `${methodName} defined but does not exist in ${this._storeName}`
        )
      }

      if (Array.isArray(symbol)) {
        symbol.forEach((action) => {
          this.bindAction(action, listener)
        })
      } else {
        this.bindAction(symbol, listener)
      }
    }, [obj])
  }
}

export default StoreMixin
