import { getChildContext, getContextByTypes } from "../src/CompositeUpdater";
import { fiberizeChildren } from "../src/createElement";
import { typeNumber } from "../src/util";
import { encodeEntities } from "./util";
import { stringifyAttributes } from "./attributes";

function renderVNode(vnode, context) {
    var { vtype, type, props } = vnode;
    switch (type) {
    case "#text":
        return encodeEntities(vnode.text);
    case "#comment":
        return "<!--" + vnode.text + "-->";
    default:
        var innerHTML = props && props.dangerouslySetInnerHTML;
        innerHTML = innerHTML && innerHTML.__html;
        if (vtype === 1) {
            //如果是元素节点
            if (type === "option") {
                //向上找到select元素
                for (var p = vnode.return; p && p.type !== "select"; p === p.return) {}
                if (p && p.valuesSet) {
                    var curValue = getOptionValue(vnode);
                    if (p.valuesSet["&" + curValue]) {
                        props = Object.assign({ selected: "" }, props); //添加一个selected属性
                    }
                }
            } else if (type === "select") {
                var selectValue = vnode.props.value || vnode.props.defaultValue;
                if (selectValue != null) {
                    var values = [].concat(selectValue),
                        valuesSet = {};
                    values.forEach(function(el) {
                        valuesSet["&" + el] = true;
                    });
                    vnode.valuesSet = valuesSet;
                }
            }

            var str = "<" + type + stringifyAttributes(props, type);
            if (voidTags[type]) {
                return str + "/>\n";
            }
            str += ">";
            if (innerHTML) {
                str += innerHTML;
            } else {
                var fakeUpdater = {
                    vnode
                };
                var children = fiberizeChildren(props.children, fakeUpdater);
                for (var i in children) {
                    var child = children[i];
                    str += renderVNode(child, context);
                }
                vnode.updater = fakeUpdater;
            }
            return str + "</" + type + ">\n";
        } else if (vtype > 1) {
            var data = {
                context
            };
            vnode = toVnode(vnode, data);
            context = data.context;
            return renderVNode(vnode, context);
        } else if (Array.isArray(vnode)) {
            var multiChild = "";
            vnode.forEach(function(el) {
                multiChild += renderVNode(el, context);
            });
            return multiChild;
        } else {
            throw "数据不合法";
        }
    }
}

function getOptionValue(option) {
    if ("value" in option.props) {
        return option.props.value;
    } else {
        var a = option.props.children;
        if (a + "" === "a") {
            return a;
        } else {
            return a.text;
        }
    }
}

const voidTags = ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"];

/**
 * 将组件虚拟DOM进行实例化，不断render，归化为元素虚拟DOM或文本节点或数组
 * @param {*} vnode 组件虚拟DOM
 * @param {*} data 一个包含context的对象
 */
function toVnode(vnode, data) {
    var parentContext = data.context,
        Type = vnode.type,
        instance,
        rendered;

    if (vnode.vtype > 1) {
        var props = vnode.props;
        // props = getComponentProps(Type, props)
        var instanceContext = getContextByTypes(parentContext, Type.contextTypes);
        if (vnode.vtype === 4) {
            //处理无状态组件
            rendered = Type(props, instanceContext);
            if (rendered && rendered.render) {
                rendered = rendered.render();
            }
            instance = {};
        } else {
            //处理普通组件
            instance = new Type(props, instanceContext);
            instance.props = instance.props || props;
            instance.context = instance.context || instanceContext;
            if (instance.componentWillMount) {
                try {
                    instance.componentWillMount();
                } catch (e) {}
            }
            rendered = instance.render();
        }

        rendered = fixVnode(rendered);

        if (instance.componentWillMount) {
            instance.componentWillMount();
        }
        // <App />下面存在<A ref="a"/>那么AppInstance.refs.a = AInstance
        // patchRef(vnode._owner, vnode.props.ref, instance)

        if (instance.getChildContext) {
            data.context = getChildContext(instance, parentContext); //将context往下传
        }
        if (Array.isArray(rendered)) {
            return rendered.map(function(el) {
                return toVnode(el, data, instance);
            });
        } else {
            return toVnode(rendered, data, instance);
        }
    } else {
        return vnode;
    }
}

//==================实现序列化文本节点与属性值的相关方法=============

function fixVnode(vnode) {
    var number = typeNumber(vnode);
    if (number < 3) {
        // 0, 1, 2
        return {
            vtype: 0,
            text: "",
            type: "#text"
        };
    } else if (number < 5) {
        //3, 4
        return {
            vtype: 0,
            text: vnode + "",
            type: "#text"
        };
    } else {
        return vnode;
    }
}

function renderToString(vnode, context) {
    return renderVNode(fixVnode(vnode), context || {});
}

export default {
    renderToString,
    renderToStaticMarkup: renderToString
};
