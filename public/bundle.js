
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.20.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.20.1 */

    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let header;
    	let div3;
    	let h1;
    	let t1;
    	let h20;
    	let t3;
    	let div2;
    	let div0;
    	let t5;
    	let div1;
    	let t7;
    	let main;
    	let section0;
    	let a;
    	let img;
    	let img_src_value;
    	let t8;
    	let p0;
    	let t10;
    	let section1;
    	let div4;
    	let h21;
    	let t12;
    	let p1;
    	let t14;
    	let footer;
    	let h22;
    	let t16;
    	let div5;

    	const block = {
    		c: function create() {
    			header = element("header");
    			div3 = element("div");
    			h1 = element("h1");
    			h1.textContent = "ASH2020";
    			t1 = space();
    			h20 = element("h2");
    			h20.textContent = "IS COMING";
    			t3 = space();
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "FIND CODES";
    			t5 = space();
    			div1 = element("div");
    			div1.textContent = "WIN BIG";
    			t7 = space();
    			main = element("main");
    			section0 = element("section");
    			a = element("a");
    			img = element("img");
    			t8 = space();
    			p0 = element("p");
    			p0.textContent = "Do you have what it takes?";
    			t10 = space();
    			section1 = element("section");
    			div4 = element("div");
    			h21 = element("h2");
    			h21.textContent = "Prizes include:";
    			t12 = space();
    			p1 = element("p");
    			p1.textContent = "Cash and products valued at $850.00+";
    			t14 = space();
    			footer = element("footer");
    			h22 = element("h2");
    			h22.textContent = "Your Hunt Begins Soon!";
    			t16 = space();
    			div5 = element("div");
    			div5.textContent = "© 2020 AmmoSeek, LLC";
    			attr_dev(h1, "class", "svelte-111w6s6");
    			add_location(h1, file, 103, 6, 2179);
    			attr_dev(h20, "class", "svelte-111w6s6");
    			add_location(h20, file, 104, 6, 2202);
    			attr_dev(div0, "class", "subtitle-item svelte-111w6s6");
    			add_location(div0, file, 106, 9, 2264);
    			attr_dev(div1, "class", "subtitle-item svelte-111w6s6");
    			add_location(div1, file, 107, 9, 2317);
    			attr_dev(div2, "class", "subtitle-flex svelte-111w6s6");
    			add_location(div2, file, 105, 6, 2227);
    			attr_dev(div3, "class", "header-content svelte-111w6s6");
    			add_location(div3, file, 102, 3, 2144);
    			attr_dev(header, "class", "header-image svelte-111w6s6");
    			add_location(header, file, 101, 0, 2111);
    			if (img.src !== (img_src_value = "/images/aslogo.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "AmmoSeek Logo");
    			add_location(img, file, 114, 9, 2500);
    			attr_dev(a, "href", "https://ammoseek.com");
    			attr_dev(a, "class", "logo-wrapper svelte-111w6s6");
    			add_location(a, file, 113, 6, 2438);
    			attr_dev(p0, "class", "svelte-111w6s6");
    			add_location(p0, file, 116, 6, 2570);
    			attr_dev(section0, "class", "logo-content svelte-111w6s6");
    			add_location(section0, file, 112, 3, 2401);
    			attr_dev(h21, "class", "svelte-111w6s6");
    			add_location(h21, file, 121, 9, 2699);
    			attr_dev(p1, "class", "svelte-111w6s6");
    			add_location(p1, file, 122, 9, 2733);
    			attr_dev(div4, "class", "section-content svelte-111w6s6");
    			add_location(div4, file, 120, 6, 2660);
    			attr_dev(section1, "class", "section-image svelte-111w6s6");
    			add_location(section1, file, 119, 3, 2622);
    			add_location(main, file, 111, 0, 2391);
    			attr_dev(h22, "class", "svelte-111w6s6");
    			add_location(h22, file, 127, 3, 2824);
    			attr_dev(div5, "class", "copyright svelte-111w6s6");
    			add_location(div5, file, 128, 3, 2859);
    			attr_dev(footer, "class", "svelte-111w6s6");
    			add_location(footer, file, 126, 0, 2812);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div3);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, h20);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, section0);
    			append_dev(section0, a);
    			append_dev(a, img);
    			append_dev(section0, t8);
    			append_dev(section0, p0);
    			append_dev(main, t10);
    			append_dev(main, section1);
    			append_dev(section1, div4);
    			append_dev(div4, h21);
    			append_dev(div4, t12);
    			append_dev(div4, p1);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, h22);
    			append_dev(footer, t16);
    			append_dev(footer, div5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(main);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    let message = '...loading';

    const app = new App({
       target: document.body,
       props: {
          name: 'Marcaeld',
          message
       }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
