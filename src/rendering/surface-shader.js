import * as THREE from 'three';
const SURFACE_SHADER_KEY='tetherless3d-exterior-toon-v1';
/** Shared exterior shading for editable brush meshes. */
export function applyToonSurfaceShader(material,{strength=.72}={}){
  material.userData.surfaceShader='exterior-toon';
  material.onBeforeCompile=(shader)=>{
    shader.uniforms.uSurfaceToonStrength={value:strength};
    shader.uniforms.uSurfaceLightDirection={value:new THREE.Vector3(-.45,.82,.35)};
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uSurfaceToonStrength;
      uniform vec3 uSurfaceLightDirection;`
    );
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      float surfaceNdotL=max(dot(normalize(normal),normalize(mat3(viewMatrix)*uSurfaceLightDirection)),0.0);
      float surfaceBands=surfaceNdotL<0.28?0.48:(surfaceNdotL<0.66?0.76:1.0);
      outgoingLight*=mix(1.0,surfaceBands,clamp(uSurfaceToonStrength,0.0,1.0));`
    );
  };
  material.customProgramCacheKey=()=>SURFACE_SHADER_KEY;
  material.needsUpdate=true;
  return material;
}
