// Vercel routes /api/transit/* here. The handler is the same one the Cloudflare worker and the local
// dev server use, so the provider key never reaches the browser on any of the three, and the
// in-memory response cache behaves the same way in all of them.
import {handleTransit} from '../../server/transit.mjs';

export const config={runtime:'nodejs'};

export default async function handler(request){
 return handleTransit(request,process.env);
}
