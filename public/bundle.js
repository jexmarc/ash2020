
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
    	let link;
    	let t0;
    	let header;
    	let div3;
    	let h1;
    	let t2;
    	let h20;
    	let t4;
    	let div2;
    	let div0;
    	let t6;
    	let div1;
    	let t8;
    	let main;
    	let section0;
    	let a;
    	let img;
    	let img_src_value;
    	let t9;
    	let p;
    	let t11;
    	let section1;
    	let div4;
    	let h21;
    	let t13;
    	let ul;
    	let li0;
    	let t15;
    	let li1;
    	let t17;
    	let li2;
    	let t19;
    	let li3;
    	let t21;
    	let footer;
    	let h22;
    	let t23;
    	let div5;

    	const block = {
    		c: function create() {
    			link = element("link");
    			t0 = space();
    			header = element("header");
    			div3 = element("div");
    			h1 = element("h1");
    			h1.textContent = "ASH2020";
    			t2 = space();
    			h20 = element("h2");
    			h20.textContent = "IS COMING";
    			t4 = space();
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "FIND CODES";
    			t6 = space();
    			div1 = element("div");
    			div1.textContent = "WIN BIG";
    			t8 = space();
    			main = element("main");
    			section0 = element("section");
    			a = element("a");
    			img = element("img");
    			t9 = space();
    			p = element("p");
    			p.textContent = "Do you have what it takes to complete the adventure?";
    			t11 = space();
    			section1 = element("section");
    			div4 = element("div");
    			h21 = element("h2");
    			h21.textContent = "Prizes include:";
    			t13 = space();
    			ul = element("ul");
    			li0 = element("li");
    			li0.textContent = "Cash";
    			t15 = space();
    			li1 = element("li");
    			li1.textContent = "Products";
    			t17 = space();
    			li2 = element("li");
    			li2.textContent = "Swag";
    			t19 = space();
    			li3 = element("li");
    			li3.textContent = "MORE!";
    			t21 = space();
    			footer = element("footer");
    			h22 = element("h2");
    			h22.textContent = "Your Hunt Begins Soon!";
    			t23 = space();
    			div5 = element("div");
    			div5.textContent = "© 2020 AmmoSeek, LLC";
    			attr_dev(link, "rel", "icon");
    			attr_dev(link, "type", "image/png");
    			attr_dev(link, "href", "favicon.png");
    			add_location(link, file, 109, 3, 2267);
    			document.title = "ASH 2020 Coming Soon - AmmoSeek.com";
    			attr_dev(h1, "class", "svelte-jrq6lv");
    			add_location(h1, file, 114, 6, 2460);
    			attr_dev(h20, "class", "svelte-jrq6lv");
    			add_location(h20, file, 115, 6, 2483);
    			attr_dev(div0, "class", "subtitle-item svelte-jrq6lv");
    			add_location(div0, file, 117, 9, 2545);
    			attr_dev(div1, "class", "subtitle-item svelte-jrq6lv");
    			add_location(div1, file, 118, 9, 2598);
    			attr_dev(div2, "class", "subtitle-flex svelte-jrq6lv");
    			add_location(div2, file, 116, 6, 2508);
    			attr_dev(div3, "class", "header-content svelte-jrq6lv");
    			add_location(div3, file, 113, 3, 2425);
    			attr_dev(header, "class", "header-image svelte-jrq6lv");
    			add_location(header, file, 112, 0, 2392);
    			if (img.src !== (img_src_value = "/images/aslogo.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "AmmoSeek Logo");
    			add_location(img, file, 125, 9, 2781);
    			attr_dev(a, "href", "https://ammoseek.com");
    			attr_dev(a, "class", "logo-wrapper svelte-jrq6lv");
    			add_location(a, file, 124, 6, 2719);
    			attr_dev(p, "class", "svelte-jrq6lv");
    			add_location(p, file, 127, 6, 2851);
    			attr_dev(section0, "class", "logo-content svelte-jrq6lv");
    			add_location(section0, file, 123, 3, 2682);
    			attr_dev(h21, "class", "svelte-jrq6lv");
    			add_location(h21, file, 132, 9, 3006);
    			attr_dev(li0, "class", "svelte-jrq6lv");
    			add_location(li0, file, 134, 12, 3057);
    			attr_dev(li1, "class", "svelte-jrq6lv");
    			add_location(li1, file, 135, 12, 3083);
    			attr_dev(li2, "class", "svelte-jrq6lv");
    			add_location(li2, file, 136, 12, 3113);
    			attr_dev(li3, "class", "svelte-jrq6lv");
    			add_location(li3, file, 137, 12, 3139);
    			attr_dev(ul, "class", "svelte-jrq6lv");
    			add_location(ul, file, 133, 9, 3040);
    			attr_dev(div4, "class", "section-content svelte-jrq6lv");
    			add_location(div4, file, 131, 6, 2967);
    			attr_dev(section1, "class", "section-image svelte-jrq6lv");
    			add_location(section1, file, 130, 3, 2929);
    			add_location(main, file, 122, 0, 2672);
    			attr_dev(h22, "class", "svelte-jrq6lv");
    			add_location(h22, file, 143, 3, 3216);
    			attr_dev(div5, "class", "copyright svelte-jrq6lv");
    			add_location(div5, file, 144, 3, 3251);
    			attr_dev(footer, "class", "svelte-jrq6lv");
    			add_location(footer, file, 142, 0, 3204);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, link);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, header, anchor);
    			append_dev(header, div3);
    			append_dev(div3, h1);
    			append_dev(div3, t2);
    			append_dev(div3, h20);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t6);
    			append_dev(div2, div1);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, section0);
    			append_dev(section0, a);
    			append_dev(a, img);
    			append_dev(section0, t9);
    			append_dev(section0, p);
    			append_dev(main, t11);
    			append_dev(main, section1);
    			append_dev(section1, div4);
    			append_dev(div4, h21);
    			append_dev(div4, t13);
    			append_dev(div4, ul);
    			append_dev(ul, li0);
    			append_dev(ul, t15);
    			append_dev(ul, li1);
    			append_dev(ul, t17);
    			append_dev(ul, li2);
    			append_dev(ul, t19);
    			append_dev(ul, li3);
    			insert_dev(target, t21, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, h22);
    			append_dev(footer, t23);
    			append_dev(footer, div5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			detach_dev(link);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(main);
    			if (detaching) detach_dev(t21);
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
