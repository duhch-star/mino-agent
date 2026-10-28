/** Own late permission results: invalidated requests release all returned tracks. */
export function createCameraRequest(getUserMedia) {
 let generation=0;
 return {
  invalidate(){generation++;},
  async acquire(){
   const token=++generation;
   try {
    const stream=await getUserMedia({video:true,audio:false});
    if(token!==generation){stream.getTracks().forEach(track=>track.stop());return null;}
    return stream;
   }catch(error){if(token!==generation)return null;throw error;}
  }
 };
}
