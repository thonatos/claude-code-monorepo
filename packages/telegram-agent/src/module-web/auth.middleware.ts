import type { ArtusXContext, ArtusXNext } from "@artusx/core";
import { Middleware } from "@artusx/core";

@Middleware({
  enable: true,
})
export class AuthMiddleware {
  async use(ctx: ArtusXContext, next: ArtusXNext): Promise<void> {
    const config = ctx.app.config;
    const enableAuth = config.artusx?.webhook?.enableAuth;

    if (!enableAuth) {
      await next();
      return;
    }

    const token = ctx.headers.authorization?.replace("Bearer ", "");
    const configToken = config.artusx?.webhook?.token;

    if (!token || token !== configToken) {
      ctx.status = 401;
      ctx.body = {
        error: "Unauthorized",
        message: "Invalid or missing authorization token",
      };
      return;
    }

    await next();
  }
}
