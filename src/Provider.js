import React, { Children, Component } from "react"
import { polyfill } from "react-lifecycles-compat"
import * as PropTypes from "./propTypes"
import Context, { supportsContext } from "./context"

const specialReactKeys = { children: true, key: true, ref: true }

const Provider = props => {
    // Can be removed when supporting React 16+ only
    if (!supportsContext) {
        return <OldProvider {...props} />
    }
    const { ref, children, ...stores } = props
    if (ref) {
        console.warn(
            "MobX Provider: Passing ref is not supported. What do you expect it to do anyway? :)"
        )
    }
    return <Context.Provider value={stores}>{Children.only(children)}</Context.Provider>
}

class OldProvider extends Component {
    static contextTypes = {
        mobxStores: PropTypes.objectOrObservableObject
    }

    static childContextTypes = {
        mobxStores: PropTypes.objectOrObservableObject.isRequired
    }

    constructor(props, context) {
        super(props, context)
        this.state = {}
        copyStores(props, this.state)
    }

    render() {
        return Children.only(this.props.children)
    }

    getChildContext() {
        const stores = {}
        // inherit stores
        copyStores(this.context.mobxStores, stores)
        // add own stores
        copyStores(this.props, stores)
        return {
            mobxStores: stores
        }
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!nextProps) return null
        if (!prevState) return nextProps

        // Maybe this warning is too aggressive?
        if (
            Object.keys(nextProps).filter(validStoreName).length !==
            Object.keys(prevState).filter(validStoreName).length
        )
            console.warn(
                "MobX Provider: The set of provided stores has changed. Please avoid changing stores as the change might not propagate to all children"
            )
        if (!nextProps.suppressChangedStoreWarning)
            for (let key in nextProps)
                if (validStoreName(key) && prevState[key] !== nextProps[key])
                    console.warn(
                        "MobX Provider: Provided store '" +
                            key +
                            "' has changed. Please avoid replacing stores as the change might not propagate to all children"
                    )

        return nextProps
    }
}

function copyStores(from, to) {
    if (!from) return
    for (let key in from) if (validStoreName(key)) to[key] = from[key]
}

function validStoreName(key) {
    return !specialReactKeys[key] && key !== "suppressChangedStoreWarning"
}

// TODO: kill in next major
polyfill(OldProvider)

export default Provider
