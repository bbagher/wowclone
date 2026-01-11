let wasm;

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const PlayerPhysicsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_playerphysics_free(ptr >>> 0, 1));

const Vector3Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_vector3_free(ptr >>> 0, 1));

export class PlayerPhysics {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PlayerPhysicsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_playerphysics_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get_rotation() {
        const ret = wasm.playerphysics_get_movement_angle(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set the grounded state and reset vertical velocity
     * This is called from TypeScript when collision detection determines
     * the player has landed on a surface (ground, rock, platform, etc.)
     * @param {boolean} grounded
     */
    set_grounded(grounded) {
        wasm.playerphysics_set_grounded(this.__wbg_ptr, grounded);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    set_position(x, y, z) {
        wasm.playerphysics_set_position(this.__wbg_ptr, x, y, z);
    }
    /**
     * @returns {number}
     */
    get_position_x() {
        const ret = wasm.playerphysics_get_position_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_position_y() {
        const ret = wasm.playerphysics_get_position_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_position_z() {
        const ret = wasm.playerphysics_get_position_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * Get movement direction for character rotation
     * @returns {number}
     */
    get_movement_angle() {
        const ret = wasm.playerphysics_get_movement_angle(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.playerphysics_new();
        this.__wbg_ptr = ret >>> 0;
        PlayerPhysicsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Update physics simulation
     * Parameters:
     * - move_x: horizontal movement input (-1 to 1)
     * - move_z: forward movement input (-1 to 1)
     * - forward_x, forward_z: camera forward direction (normalized)
     * - right_x, right_z: camera right direction (normalized)
     * - is_sprinting: whether sprint is active
     * - should_jump: whether jump button is pressed
     * - delta_time: time step for frame-rate independent physics
     * @param {number} move_x
     * @param {number} move_z
     * @param {number} forward_x
     * @param {number} forward_z
     * @param {number} right_x
     * @param {number} right_z
     * @param {boolean} is_sprinting
     * @param {boolean} should_jump
     * @param {number} delta_time
     */
    update(move_x, move_z, forward_x, forward_z, right_x, right_z, is_sprinting, should_jump, delta_time) {
        wasm.playerphysics_update(this.__wbg_ptr, move_x, move_z, forward_x, forward_z, right_x, right_z, is_sprinting, should_jump, delta_time);
    }
    /**
     * @returns {boolean}
     */
    is_moving() {
        const ret = wasm.playerphysics_is_moving(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) PlayerPhysics.prototype[Symbol.dispose] = PlayerPhysics.prototype.free;

export class Vector3 {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Vector3.prototype);
        obj.__wbg_ptr = ptr;
        Vector3Finalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        Vector3Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_vector3_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_vector3_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_vector3_x(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_vector3_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_vector3_y(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.__wbg_get_vector3_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set z(arg0) {
        wasm.__wbg_set_vector3_z(this.__wbg_ptr, arg0);
    }
    /**
     * @param {Vector3} other
     * @returns {Vector3}
     */
    add(other) {
        _assertClass(other, Vector3);
        const ret = wasm.vector3_add(this.__wbg_ptr, other.__wbg_ptr);
        return Vector3.__wrap(ret);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    constructor(x, y, z) {
        const ret = wasm.vector3_new(x, y, z);
        this.__wbg_ptr = ret >>> 0;
        Vector3Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} scalar
     * @returns {Vector3}
     */
    scale(scalar) {
        const ret = wasm.vector3_scale(this.__wbg_ptr, scalar);
        return Vector3.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    length() {
        const ret = wasm.vector3_length(this.__wbg_ptr);
        return ret;
    }
    normalize() {
        wasm.vector3_normalize(this.__wbg_ptr);
    }
}
if (Symbol.dispose) Vector3.prototype[Symbol.dispose] = Vector3.prototype.free;

export function init() {
    wasm.init();
}

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg___wbindgen_throw_dd24417ed36fc46e = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('game_physics_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
