import { ArtusInjectEnum, Inject, Injectable } from "@artusx/core";
import type { AppConfig } from "../types";

@Injectable()
export class AuthService {
  @Inject(ArtusInjectEnum.Config)
  private config!: AppConfig;

  /**
   * Check if user is authorized to use the bot.
   * Empty allowedUsers list = open mode (allow all)
   */
  isAuthorized(userId: string | undefined): boolean {
    const allowedUsers = this.config.allowedUsers ?? [];

    // Open mode: empty list allows all users
    if (allowedUsers.length === 0) return true;

    // No userId = not authorized
    if (!userId) return false;

    // Check if userId is in allowed list
    return allowedUsers.includes(userId);
  }
}
