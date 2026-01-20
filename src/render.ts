import { mat3, mat4, vec3 } from "gl-matrix";
import shaders from "./shaders.ts";
import { mat3ext, mat4ext, vec3ext } from "./math.ts";

export async function setup(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("webgpu")
    
    if (context) {
        const adapter = await window.navigator.gpu.requestAdapter()
        if (adapter) {
            const format = window.navigator.gpu.getPreferredCanvasFormat()
            const device = await adapter.requestDevice()
            
            context.configure({
                device,
                format
            })
            
            start({
                context,
                format,
                device
            })
            
        } else {
            throw new Error("无法获取适配器")
        }
    } else {
        throw new Error("无法获取上下文")
    }
    
}

export async function start({
    context,
    format,
    device
}: {
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    device: GPUDevice
}) {
    
    
    const data = build()
    const resources = create({
        format,
        context,
        device,
        data
    })
    
    write({ device, data, resources })
    
    const encoder = device.createCommandEncoder()
    const target = context.getCurrentTexture().createView()
    
    clear({
        encoder,
        target,
        depthTarget: resources.depthTextureView
    })
    
    render_({
        encoder,
        target,
        depthTarget: resources.depthTextureView,
        resources
    })
    
    device.queue.submit([encoder.finish()])
}

type Data = ReturnType<typeof build>

function build() {
    
    // Build Vertexes
    
    const positions = [
        vec3.fromValues(-1, -1, -1),
        vec3.fromValues(+1, -1, -1),
        vec3.fromValues(-1, +1, -1),
        vec3.fromValues(+1, +1, -1),
        vec3.fromValues(-1, -1, +1),
        vec3.fromValues(+1, -1, +1),
        vec3.fromValues(-1, +1, +1),
        vec3.fromValues(+1, +1, +1),
    ]
    
    const indexes = [
        vec3.fromValues(0, 2, 1),
        vec3.fromValues(2, 3, 1),
        vec3.fromValues(5, 7, 4),
        vec3.fromValues(7, 6, 4),
        vec3.fromValues(4, 6, 2),
        vec3.fromValues(4, 2, 0),
        vec3.fromValues(1, 3, 5),
        vec3.fromValues(3, 7, 5),
        vec3.fromValues(4, 0, 5),
        vec3.fromValues(0, 1, 5),
        vec3.fromValues(2, 6, 3),
        vec3.fromValues(6, 7, 3),
    ]
    
    const faceNormals = indexes.map(([aIndex, bIndex, cIndex]) => {
        const ba = vec3.sub(vec3.create(), positions[bIndex], positions[aIndex])
        const ca = vec3.sub(vec3.create(), positions[cIndex], positions[aIndex])
        
        const normal = vec3.cross(vec3.create(), ba, ca)
        vec3.normalize(normal, normal)
        
        return normal
    })
    
    const normals = positions.map(position => vec3.copy(vec3.create(), position))
    indexes.forEach(([aIndex, bIndex, cIndex], faceIndex) => {
        vec3.add(normals[aIndex], normals[aIndex], faceNormals[faceIndex])
        vec3.add(normals[bIndex], normals[bIndex], faceNormals[faceIndex])
        vec3.add(normals[cIndex], normals[cIndex], faceNormals[faceIndex])
    })
    normals.map(normal => vec3.normalize(normal, normal))
    
    console.log("indexes", indexes)
    console.log("positions", positions)
    console.log("faceNormals", faceNormals)
    console.log("normals", normals)
    
    // Build Transforms
    
    const view = mat4.create()
    mat4.translate(view, view, [0, 0, -4.5])
    mat4.rotateX(view, view, Math.PI / 4)
    mat4.rotateY(view, view, Math.PI / 4)
    
    const projection = mat4.create()
    mat4.perspective(projection, 45, 1, 0.01, 10000)
    
    const normal = mat3.create()
    
    console.log("view", mat4ext.toVectors(view))
    console.log("projection", mat4ext.toVectors(projection))
    console.log("normal", mat3ext.toVectors(normal))
    
    return {
        indexes: Uint32Array.from(vec3ext.flat(indexes)),
        vertex: {
            positions: Float32Array.from(vec3ext.flat(positions)),
            colors: Float32Array.from(
                new Array(8)
                    .fill(0)
                    .map(() => [1, 1, 1, 1])
                    .flat()
            ),
            normals: Float32Array.from(vec3ext.flat(normals)),
        },
        uniforms: {
            transform: {
                modelMatrix: Float32Array.from(mat4.create()),
                viewMatrix: Float32Array.from(view),
                projectionMatrix: Float32Array.from(projection),
                normalMatrix: Float32Array.from(mat3.create()),
            },
            material: {
                baseColor: Float32Array.of(1, 1, 1, 1)
            }
        }
    } as const
}

type Resources = ReturnType<typeof create>

function create({
    format,
    context,
    device,
    data
}: {
    format: GPUTextureFormat,
    context: GPUCanvasContext,
    device: GPUDevice,
    data: Data,
}) {
    const depthTexture = device.createTexture({
        size: {
            width: context.canvas.width,
            height: context.canvas.height
        },
        format: "depth32float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    })
    const depthTextureView = depthTexture.createView()
    
    const vertex = device.createShaderModule({
        code: shaders.vertex
    })
    
    const fragment = device.createShaderModule({
        code: shaders.fragment
    })
    
    const vertexLayouts: GPUVertexBufferLayout[] = [
        {
            arrayStride: 12,
            attributes: [{
                shaderLocation: 0,
                format: "float32x3",
                offset: 0
            }]
        },
        {
            arrayStride: 16,
            attributes: [{
                shaderLocation: 1,
                format: "float32x4",
                offset: 0
            }]
        },
        {
            arrayStride: 12,
            attributes: [{
                shaderLocation: 2,
                format: "float32x3",
                offset: 0
            }]
        }
    ]
    
    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: vertex,
            entryPoint: "main",
            buffers: vertexLayouts
        },
        fragment: {
            module: fragment,
            entryPoint: "main",
            targets: [{
                format: format
            }]
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "back"
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth32float'
        },
        multisample: {
            count: 1
        }
    })
    
    const uniforms = {
        transform: {
            modelMatrix: device.createBuffer({
                size: Math.max(64, data.uniforms.transform.modelMatrix.byteLength),
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            }),
            viewMatrix: device.createBuffer({
                size: Math.max(64, data.uniforms.transform.viewMatrix.byteLength),
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            }),
            projectionMatrix: device.createBuffer({
                size: Math.max(64, data.uniforms.transform.projectionMatrix.byteLength),
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            }),
            normalMatrix: device.createBuffer({
                size: Math.max(64, data.uniforms.transform.normalMatrix.byteLength),
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            }),
        },
        material: {
            baseColor: device.createBuffer({
                size: Math.max(64, data.uniforms.material.baseColor.byteLength),
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            }),
        }
    }
    
    const bindGroups = {
        transform: device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: uniforms.transform.modelMatrix,
                },
                {
                    binding: 1,
                    resource: uniforms.transform.viewMatrix,
                },
                {
                    binding: 2,
                    resource: uniforms.transform.projectionMatrix,
                },
                {
                    binding: 3,
                    resource: uniforms.transform.normalMatrix,
                }
            ]
        }),
        material: device.createBindGroup({
            layout: pipeline.getBindGroupLayout(1),
            entries: [{
                binding: 0,
                resource: uniforms.material.baseColor
            }]
        })
    }
    
    return {
        depthTexture,
        depthTextureView,
        pipeline,
        indexes: device.createBuffer({
            size: data.indexes.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
        }),
        vertex: {
            positions: device.createBuffer({
                size: data.vertex.positions.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
            }),
            colors: device.createBuffer({
                size: data.vertex.colors.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
            }),
            normals: device.createBuffer({
                size: data.vertex.normals.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
            }),
        },
        uniforms,
        bindGroups
    } as const
}

function write({
    device,
    data,
    resources: {
        indexes,
        vertex,
        uniforms,
    }
}: {
    device: GPUDevice,
    data: Data,
    resources: Resources
}) {
    
    function writeBuffer(buffer: GPUBuffer, data: ArrayBuffer) {
        device.queue.writeBuffer(buffer, 0, data, 0, data.byteLength)
    }
    
    writeBuffer(indexes, data.indexes.buffer)
    writeBuffer(vertex.positions, data.vertex.positions.buffer)
    writeBuffer(vertex.colors, data.vertex.colors.buffer)
    writeBuffer(vertex.normals, data.vertex.normals.buffer)
    
    writeBuffer(uniforms.transform.modelMatrix, data.uniforms.transform.modelMatrix.buffer)
    writeBuffer(uniforms.transform.viewMatrix, data.uniforms.transform.viewMatrix.buffer)
    writeBuffer(uniforms.transform.projectionMatrix, data.uniforms.transform.projectionMatrix.buffer)
    writeBuffer(uniforms.transform.normalMatrix, data.uniforms.transform.normalMatrix.buffer)
    writeBuffer(uniforms.material.baseColor, data.uniforms.material.baseColor.buffer)
    
}

function clear({
    encoder,
    target,
    depthTarget
}: {
    encoder: GPUCommandEncoder,
    target: GPUTextureView,
    depthTarget: GPUTextureView
}) {
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: target,
            loadOp: "clear",
            storeOp: "store",
            // clearValue: [0.5, 0.5, 0.5, 0.5],
            // clearValue: [0, 0, 0, 0],
            clearValue: [1, 1, 1, 1],
        }],
        depthStencilAttachment: {
            view: depthTarget,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            depthClearValue: 1
        },
    })
    pass.end()
    return pass
}

function render_({
    encoder,
    target,
    depthTarget,
    resources: {
        pipeline,
        bindGroups,
        indexes,
        vertex
    }
}: {
    resources: Resources,
    encoder: GPUCommandEncoder,
    target: GPUTextureView,
    depthTarget: GPUTextureView,
}) {
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: target,
            loadOp: "load",
            storeOp: "store",
        }],
        depthStencilAttachment: {
            view: depthTarget,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            depthClearValue: 1
        }
    })
    
    pass.setPipeline(pipeline)
    
    pass.setVertexBuffer(0, vertex.positions)
    pass.setVertexBuffer(1, vertex.colors)
    pass.setVertexBuffer(2, vertex.normals)
    pass.setIndexBuffer(indexes, "uint32")
    
    pass.setBindGroup(0, bindGroups.transform)
    pass.setBindGroup(1, bindGroups.material)
    
    pass.drawIndexed(12 * 3)
    pass.end()
}
