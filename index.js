(function() {
    function mrFactory(mobservable, React, ReactDOM) {
        if (!mobservable)
            throw new Error("mobservable-react requires the Mobservable package")
        if (!React)
            throw new Error("mobservable-react requires React to be available");

        var isDevtoolsEnabled = false;

        // WeakMap<Node, Object>;
        var componentByNodeRegistery = typeof WeakMap !== "undefined" ? new WeakMap() : undefined;
        var renderReporter = new mobservable.SimpleEventEmitter();

        function findDOMNode(component) {
            if (ReactDOM)
                return ReactDOM.findDOMNode(component);
            return null;
        }

        function reportRendering(component) {
            var node = findDOMNode(component);
            if (node)
                componentByNodeRegistery.set(node, component);

            renderReporter.emit({
                event: 'render',
                renderTime: component.__$mobRenderEnd - component.__$mobRenderStart,
                totalTime: Date.now() - component.__$mobRenderStart,
                component: component,
                node: node
            });
        }

        var reactiveMixin = {
            componentWillMount: function() {
                // Generate friendly name for debugging
                var name = [
                    this.displayName || this.name || (this.constructor && this.constructor.name) || "<component>",
                    "#", this._reactInternalInstance && this._reactInternalInstance._rootNodeID,
                    ".render()"
                ].join("");

                var baseRender = this.render.bind(this);
                var self = this;
                var reaction = null;
                var isRenderingPending = false;
                
                function initialRender() {
                    reaction = new mobservable.Reaction(name, function() {
                        if (!isRenderingPending) {
                            isRenderingPending = true;
                            React.Component.prototype.forceUpdate.call(self)
                        }
                    });
                    reactiveRender.$mobservable = reaction;
                    self.render = reactiveRender;
                    return reactiveRender();
                }

                function reactiveRender() {
                    isRenderingPending = false;
                    var rendering;
                    reaction.track(function() {
                        if (isDevtoolsEnabled)
                            self.__$mobRenderStart = Date.now();
                        rendering = mobservable.extras.allowStateChanges(false, baseRender);
                        if (isDevtoolsEnabled)
                            self.__$mobRenderEnd = Date.now();
                    });
                    return rendering;
                }

                this.render = initialRender;
            },

            componentWillUnmount: function() {
                this.render.$mobservable && this.render.$mobservable.dispose();
                if (isDevtoolsEnabled) {
                    var node = findDOMNode(this);
                    if (node) {
                        componentByNodeRegistery.delete(node);
                    }
                    renderReporter.emit({
                        event: 'destroy',
                        component: this,
                        node: node
                    });
                }
            },

            componentDidMount: function() {
                if (isDevtoolsEnabled)
                    reportRendering(this);
            },

            componentDidUpdate: function() {
                if (isDevtoolsEnabled)
                    reportRendering(this);
            },

            shouldComponentUpdate: function(nextProps, nextState) {
                // TODO: if context changed, return true.., see #18
                
                // if props or state did change, but a render was scheduled already, no additional render needs to be scheduled
                if (this.render.$mobservable && this.render.$mobservable.isScheduled() === true)
                    return false;
                
                // update on any state changes (as is the default)
                if (this.state !== nextState)
                    return true;
                // update if props are shallowly not equal, inspired by PureRenderMixin
                var keys = Object.keys(this.props);
                var key;
                if (keys.length !== Object.keys(nextProps).length)
                    return true;
                for(var i = keys.length -1; i >= 0, key = keys[i]; i--) {
                    var newValue = nextProps[key];
                    if (newValue !== this.props[key]) {
                        return true;
                    } else if (newValue && typeof newValue === "object" && !mobservable.isObservable(newValue)) {
                        /**
                         * If the newValue is still the same object, but that object is not observable,
                         * fallback to the default React behavior: update, because the object *might* have changed.
                         * If you need the non default behavior, just use the React pure render mixin, as that one
                         * will work fine with mobservable as well, instead of the default implementation of
                         * observer.
                         */
                        return true;
                    }
                }
                return false;
            }
        }

        function patch(target, funcName) {
            var base = target[funcName];
            var mixinFunc = reactiveMixin[funcName];
            target[funcName] = function() {
                base && base.apply(this, arguments);
                mixinFunc.apply(this, arguments);
            }
        }

        function observer(componentClass) {
            // If it is function but doesn't seem to be a react class constructor,
            // wrap it to a react class automatically
            if (typeof componentClass === "function" && !componentClass.prototype.render && !componentClass.isReactClass && !React.Component.isPrototypeOf(componentClass)) {
                return observer(React.createClass({
                    displayName:     componentClass.displayName || componentClass.name,
                    propTypes:       componentClass.propTypes,
                    contextTypes:    componentClass.contextTypes,
                    getDefaultProps: function() { return componentClass.defaultProps; },
                    render:          function() { return componentClass.call(this, this.props, this.context); }
                }));
            }

            if (!componentClass)
                throw new Error("Please pass a valid component to 'observer'");
            var target = componentClass.prototype || componentClass;

            [
                "componentWillMount",
                "componentWillUnmount",
                "componentDidMount",
                "componentDidUpdate"
            ].forEach(function(funcName) {
                patch(target, funcName)
            });

            if (!target.shouldComponentUpdate)
                target.shouldComponentUpdate = reactiveMixin.shouldComponentUpdate;
            componentClass.isMobservableReactObserver = true;
            return componentClass;
        }

        function trackComponents() {
            if (typeof WeakMap === "undefined")
                throw new Error("[mobservable-react] tracking components is not supported in this browser.");
            if (!isDevtoolsEnabled)
                isDevtoolsEnabled = true;
        }

        return ({
            observer: observer,
            reactiveComponent: function() {
                console.warn("[mobservable-react] `reactiveComponent` has been renamed to `observer` and will be removed in 1.1.");
                return observer.apply(null, arguments);
            },
            renderReporter: renderReporter,
            componentByNodeRegistery: componentByNodeRegistery,
            trackComponents: trackComponents
        });
    }

    // UMD
    if (typeof define === 'function' && define.amd) {
        define('mobservable-react', ['mobservable', 'react', 'react-dom'], mrFactory);
    } else if (typeof exports === 'object') {
        module.exports = mrFactory(require('mobservable'), require('react'), require('react-dom'));
    } else {
        this.mobservableReact = mrFactory(this['mobservable'], this['React'], this['ReactDOM']);
    }
})();
