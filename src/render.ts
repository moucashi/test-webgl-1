import shaders from "./shaders.ts";

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

// type Data = {
//     indexes: Uint32Array
//     vertex: {
//         [key: string]: Float32Array
//     },
//     uniforms: {
//         [key: string]: {
//             [key: string]: Float32Array
//         }
//     }
// }

type Data = ReturnType<typeof build>

function build() {
    return {
        indexes: Uint32Array.of(
            0, 2, 1,
            2, 3, 1,
            5, 7, 4,
            7, 6, 4,
            
            4, 6, 2,
            4, 2, 0,
            1, 3, 5,
            3, 7, 5,
            
            4, 0, 5,
            0, 1, 5,
            2, 6, 3,
            6, 7, 3
        ),
        vertex: {
            positions: Float32Array.of(
                -1, -1, -1,
                +1, -1, -1,
                -1, +1, -1,
                +1, +1, -1,
                -1, -1, +1,
                +1, -1, +1,
                -1, +1, +1,
                +1, +1, +1
            ),
            colors: Float32Array.from(
                new Array(8)
                    .fill(0)
                    .map(() => [1, 1, 1, 1])
                    .flat()
            )
        },
        uniforms: {
            transform: {
                modelMatrix: Float32Array.of(
                    0.5, 0, 0, 0,
                    0, 0.5, 0, 0,
                    0, 0, 0.5, 0,
                    0, 0, 0, 0.5
                ),
                viewMatrix: Float32Array.of(
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ),
                projectionMatrix: Float32Array.of(
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ),
                // normalMatrix: Float32Array.of(
                //     1, 0, 0,
                //     0, 1, 0,
                //     0, 0, 1
                // )
            },
            material: {
                baseColor: Float32Array.of(1, 1, 1, 1)
            }
        }
    } as const
}

// type Buffers = {
//     indexes: GPUBuffer,
//     vertex: {
//         [key: string]: GPUBuffer
//     },
//     uniforms: {
//         [key: string]: {
//             buffer: GPUBuffer
//             offsets: {
//                 [key: string]: number
//             }
//         }
//     },
//     depthTexture: GPUTexture,
//     depthTextureView: GPUTextureView
// }

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
            // normalMatrix: device.createBuffer({
            //     size: data.uniforms.transform.normalMatrix.byteLength,
            //     usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            // }),
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
                // {
                //     binding: 3,
                //     resource: uniforms.transform.normalMatrix,
                // }
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
    
    writeBuffer(uniforms.transform.modelMatrix, data.uniforms.transform.modelMatrix.buffer)
    writeBuffer(uniforms.transform.viewMatrix, data.uniforms.transform.viewMatrix.buffer)
    writeBuffer(uniforms.transform.projectionMatrix, data.uniforms.transform.projectionMatrix.buffer)
    // writeBuffer(uniforms.transform.normalMatrix, data.uniforms.transform.normalMatrix.buffer)
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
            clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
        }],
        depthStencilAttachment: {
            view: depthTarget,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            depthClearValue: 1
        }
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
    pass.setIndexBuffer(indexes, "uint32")
    
    pass.setBindGroup(0, bindGroups.transform)
    pass.setBindGroup(1, bindGroups.material)
    
    pass.drawIndexed(12 * 3)
    pass.end()
}
