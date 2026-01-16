export const vertex = `
    struct VertexInput {
        @location(0) position: vec3<f32>,
        @location(1) color: vec4<f32>
    }
    
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>
    };
    
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
    
        output.position = sPos;
        output.color = vertex.color;
    
        return output;
    }
`

export const fragment = `
    struct FragmentInput {
        @builtin(position) fragCoord: vec4<f32>,
        @location(0) vertexColor: vec4<f32>
    }
    
    struct FragmentOutput {
        @location(0) color: vec4<f32>
    }
    
    @group(1) @binding(0)
    var<uniform> baseColor: vec4<f32>;
    
    @fragment
    fn main(fragment: FragmentInput) -> FragmentOutput {
        var output = FragmentOutput();
    
        var color = baseColor * fragment.vertexColor;
        
        output.color = color;
        
        return output;
    }
`

export default {
    vertex,
    fragment,
}