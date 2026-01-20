import { mat4, type vec3, type vec4 } from "gl-matrix";

export namespace vec3ext {
    export function flat(arr: vec3[]): number[] {
        return arr.reduce((arr: number[], cur) => {
            arr.push(...cur);
            return arr
        }, [])
    }
}

export namespace mat3ext {
    export function toVectors([
        a1, a2, a3,
        b1, b2, b3,
        c1, c2, c3,
    ]: mat4): vec3[] {
        return [
            [a1, a2, a3],
            [b1, b2, b3],
            [c1, c2, c3],
        ]
    }
}

export namespace mat4ext {
    export function toVectors([
        a1, a2, a3, a4,
        b1, b2, b3, b4,
        c1, c2, c3, c4,
        d1, d2, d3, d4,
    ]: mat4): vec4[] {
        return [
            [a1, a2, a3, a4],
            [b1, b2, b3, b4],
            [c1, c2, c3, c4],
            [d1, d2, d3, d4],
        ]
    }
}

// export function flat<T>(arr: any[]): T[] {
//     return arr
//         .reduce((arr, cur) => (arr.push(...cur), arr), [])
// }