/**
 * 'Higher Order Component' that controls the props of a wrapped
 * component via stores.
 *
 * Expects the Component to have two static methods:
 *   - getStores(): Should return an array of stores.
 *   - getPropsFromStores(props): Should return the props from the stores.
 *
 * Example using old React.createClass() style:
 *
 *    const MyComponent = React.createClass({
 *      statics: {
 *        getStores(props) {
 *          return [myStore]
 *        },
 *        getPropsFromStores(props) {
 *          return myStore.getState()
 *        }
 *      },
 *      render() {
 *        // Use this.props like normal ...
 *      }
 *    })
 *    MyComponent = connectToStores(MyComponent)
 *
 *
 * Example using ES6 Class:
 *
 *    class MyComponent extends React.Component {
 *      static getStores(props) {
 *        return [myStore]
 *      }
 *      static getPropsFromStores(props) {
 *        return myStore.getState()
 *      }
 *      render() {
 *        // Use this.props like normal ...
 *      }
 *    }
 *    MyComponent = connectToStores(MyComponent)
 *
 * A great explanation of the merits of higher order components can be found at
 * http://bit.ly/1abPkrP
 */

import React from 'react'
import { assign, isFunction } from './functions'

function connectToStores(Component) {
  // Check for required static methods.
  if (!isFunction(Component.getStores)) {
    throw new Error('connectToStores() expects the wrapped component to have a static getStores() method')
  }
  if (!isFunction(Component.getPropsFromStores)) {
    throw new Error('connectToStores() expects the wrapped component to have a static getPropsFromStores() method')
  }

  // Wrapper Component.
  const StoreConnection = React.createClass({
    getInitialState() {
      return Component.getPropsFromStores(this.props, this.context)
    },

    componentDidMount() {
      const stores = Component.getStores(this.props, this.context)
      stores.forEach((store) => {
        store.listen(this.onChange)
      })
      if (Component.componentDidConnect) {
        Component.componentDidConnect(this.props, this.context)
      }
    },

    componentWillUnmount() {
      const stores = Component.getStores(this.props, this.context)
      stores.forEach((store) => {
        store.unlisten(this.onChange)
      })
    },

    onChange() {
      this.setState(Component.getPropsFromStores(this.props, this.context))
    },

    render() {
      return React.createElement(
        Component,
        assign({}, this.props, this.state)
      )
    }
  })

  return StoreConnection
}

export default connectToStores
