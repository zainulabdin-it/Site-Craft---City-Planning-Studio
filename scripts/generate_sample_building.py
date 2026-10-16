"""Generate an original, dependency-free GLB building for Sitecraft demos."""

from __future__ import annotations

import json
import struct
from pathlib import Path


OUTPUT = Path(__file__).resolve().parents[1] / "sample-assets" / "sitecraft-modern-house.glb"


def align4(data: bytes, fill: bytes = b"\0") -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


# A 1 m cube, centred at the origin. glTF uses Y as the up axis.
faces = [
    ((0, 0, 1), [(-.5, -.5, .5), (.5, -.5, .5), (.5, .5, .5), (-.5, .5, .5)]),
    ((0, 0, -1), [(.5, -.5, -.5), (-.5, -.5, -.5), (-.5, .5, -.5), (.5, .5, -.5)]),
    ((1, 0, 0), [(.5, -.5, .5), (.5, -.5, -.5), (.5, .5, -.5), (.5, .5, .5)]),
    ((-1, 0, 0), [(-.5, -.5, -.5), (-.5, -.5, .5), (-.5, .5, .5), (-.5, .5, -.5)]),
    ((0, 1, 0), [(-.5, .5, .5), (.5, .5, .5), (.5, .5, -.5), (-.5, .5, -.5)]),
    ((0, -1, 0), [(-.5, -.5, -.5), (.5, -.5, -.5), (.5, -.5, .5), (-.5, -.5, .5)]),
]
positions: list[float] = []
normals: list[float] = []
indices: list[int] = []
for face_index, (normal, vertices) in enumerate(faces):
    for vertex in vertices:
        positions.extend(vertex)
        normals.extend(normal)
    start = face_index * 4
    indices.extend([start, start + 1, start + 2, start, start + 2, start + 3])

position_bytes = struct.pack(f"<{len(positions)}f", *positions)
normal_bytes = struct.pack(f"<{len(normals)}f", *normals)
index_bytes = struct.pack(f"<{len(indices)}H", *indices)
binary = position_bytes + normal_bytes + index_bytes

materials = [
    ("Warm white walls", [0.88, 0.84, 0.74, 1.0], 0.82),
    ("Charcoal roof", [0.08, 0.11, 0.14, 1.0], 0.72),
    ("Timber panels", [0.45, 0.20, 0.07, 1.0], 0.72),
    ("Blue glass", [0.08, 0.35, 0.52, 1.0], 0.28),
    ("Concrete", [0.43, 0.46, 0.47, 1.0], 0.92),
    ("Garden green", [0.12, 0.48, 0.20, 1.0], 0.88),
    ("Accent orange", [0.92, 0.36, 0.08, 1.0], 0.68),
]


def box(name: str, material: int, position: tuple[float, float, float], scale: tuple[float, float, float]):
    return {
        "name": name,
        "mesh": material,
        "translation": list(position),
        "scale": list(scale),
    }


nodes = [
    box("Ground slab", 4, (0, 0.15, 0), (13, 0.3, 11)),
    box("Ground floor", 0, (0, 2.0, 0.4), (10.8, 3.4, 8.0)),
    box("Upper floor", 0, (-1.4, 5.0, 0.3), (8.0, 2.6, 7.4)),
    box("Flat roof", 1, (-1.4, 6.45, 0.3), (8.6, 0.3, 8.0)),
    box("Entrance canopy", 1, (3.6, 3.1, 4.5), (3.1, 0.22, 1.8)),
    box("Front timber feature", 2, (3.0, 2.2, 4.43), (2.1, 3.8, 0.22)),
    box("Front door", 6, (3.0, 1.65, 4.58), (1.15, 2.5, 0.15)),
    box("Balcony deck", 4, (-1.2, 4.25, 4.6), (4.6, 0.22, 1.7)),
    box("Balcony rail", 1, (-1.2, 4.85, 5.35), (4.6, 1.0, 0.10)),
    box("Planter left", 5, (-5.0, 0.55, 4.6), (1.4, 0.8, 1.1)),
    box("Planter right", 5, (5.0, 0.55, 4.6), (1.4, 0.8, 1.1)),
]

for x in (-3.9, -1.4, 1.1):
    nodes.append(box(f"Ground window {x}", 3, (x, 2.15, 4.45), (1.45, 1.35, 0.12)))
for x in (-3.6, -1.2, 1.2):
    nodes.append(box(f"Upper window {x}", 3, (x, 5.05, 4.08), (1.35, 1.15, 0.12)))
for x in (-4.1, -1.4, 1.3, 4.1):
    nodes.append(box(f"Rear window {x}", 3, (x, 2.25, -3.67), (1.25, 1.25, 0.12)))

gltf = {
    "asset": {"version": "2.0", "generator": "Sitecraft sample asset generator"},
    "scene": 0,
    "scenes": [{"name": "Modern House", "nodes": list(range(len(nodes)))}],
    "nodes": nodes,
    "meshes": [
        {
            "name": material[0],
            "primitives": [
                {
                    "attributes": {"POSITION": 0, "NORMAL": 1},
                    "indices": 2,
                    "material": index,
                }
            ],
        }
        for index, material in enumerate(materials)
    ],
    "materials": [
        {
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": colour,
                "metallicFactor": 0.02,
                "roughnessFactor": roughness,
            },
        }
        for name, colour, roughness in materials
    ],
    "buffers": [{"byteLength": len(binary)}],
    "bufferViews": [
        {"buffer": 0, "byteOffset": 0, "byteLength": len(position_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": len(position_bytes), "byteLength": len(normal_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": len(position_bytes) + len(normal_bytes), "byteLength": len(index_bytes), "target": 34963},
    ],
    "accessors": [
        {
            "bufferView": 0,
            "componentType": 5126,
            "count": 24,
            "type": "VEC3",
            "min": [-0.5, -0.5, -0.5],
            "max": [0.5, 0.5, 0.5],
        },
        {"bufferView": 1, "componentType": 5126, "count": 24, "type": "VEC3"},
        {"bufferView": 2, "componentType": 5123, "count": 36, "type": "SCALAR"},
    ],
}

json_chunk = align4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")
bin_chunk = align4(binary)
total_length = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
glb = (
    struct.pack("<4sII", b"glTF", 2, total_length)
    + struct.pack("<I4s", len(json_chunk), b"JSON")
    + json_chunk
    + struct.pack("<I4s", len(bin_chunk), b"BIN\0")
    + bin_chunk
)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_bytes(glb)
print(f"Created {OUTPUT} ({len(glb)} bytes)")
