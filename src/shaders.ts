// language=WGSL
const struct = `
    struct VertexInput {
        @location(0) position: vec3<f32>,
        @location(1) color: vec4<f32>,
        @location(2) normal: vec3<f32>
    }
    
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
        @location(1) normal: vec3<f32>
    };
    
    struct FragmentOutput {
        @location(0) color: vec4<f32>
    }
`

// language=WGSL
export const vertex = `
    ${struct}
    
    @group(0) @binding(0)
    var<uniform> modelMatrix: mat4x4<f32>;
    
    @group(0) @binding(1)
    var<uniform> viewMatrix: mat4x4<f32>;

    @group(0) @binding(2)
    var<uniform> projectionMatrix: mat4x4<f32>;
    
    @group(0) @binding(3)
    var<uniform> normalMatrix: mat3x3<f32>;
    
    @vertex
    fn main(
        vertex: VertexInput
    ) -> VertexOutput {
        var pos4 = vec4<f32>(vertex.position, 1.0);
    
        var output = VertexOutput();
    
        var vPos = modelMatrix * pos4;
        vPos = viewMatrix * vPos;
        vPos.w = 1;
    
        var sPos = projectionMatrix * vPos;
        sPos.z = abs(sPos.z);
        
        var normal = normalMatrix * vertex.normal;
    
        output.position = sPos;
        output.color = vertex.color;
        output.normal = normal;
    
        return output;
    }
`

// language=WGSL
export const fragment = `
    ${struct}
    
    @group(1) @binding(0)
    var<uniform> baseColor: vec4<f32>;
    
    @fragment
    fn main(fragment: VertexOutput) -> FragmentOutput {
        var output = FragmentOutput();
        
        var normal4 = vec4<f32>(fragment.normal, 1.0);
        
//        var color = baseColor * fragment.color;
          var color = baseColor * fragment.color * (normal4 + 1) / 2;
//        color = normal4;
        
        
        output.color = color;
        
        return output;
    }
`

export default {
    vertex,
    fragment,
}