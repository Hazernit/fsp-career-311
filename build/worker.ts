import handler from "vinext/server/fetch-handler";
import { prepareProxyRequest } from "../lib/server/proxy";

export default {
  fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    const prepared = prepareProxyRequest(request, env);
    return prepared instanceof Response ? prepared : handler.fetch(prepared, env, ctx);
  },
};
