import { LifecycleHookUnit, LifecycleHook, Inject, ArtusInjectEnum, ApplicationLifecycle } from '@artusx/core';
import type { ArtusApplication } from '@artusx/core';
import { InjectEnum } from './constants';
import type { ACPClient } from './client';

@LifecycleHookUnit()
export default class ACPLifecycle implements ApplicationLifecycle {
  @Inject(ArtusInjectEnum.Application)
  private readonly app!: ArtusApplication;

  @Inject(InjectEnum.ACPClient)
  private readonly client!: ACPClient;

  get logger() {
    return this.app.logger;
  }

  @LifecycleHook()
  willReady(): void {
    // Client is initialized by services that need it
    // No automatic initialization here
    this.logger.info('[acp-plugin] ACP client ready');
  }

  @LifecycleHook()
  async beforeClose(): Promise<void> {
    this.client.reset();
    this.logger.info('[acp-plugin] ACP client reset');
  }
}
