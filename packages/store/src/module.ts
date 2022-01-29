import {
  APP_BOOTSTRAP_LISTENER,
  InjectionToken,
  Injector,
  ModuleWithProviders,
  NgModule,
  NgZone,
  Provider,
  Type
} from '@angular/core';
import {
  INITIAL_STATE_TOKEN,
  InitialState,
  NGXS_STATE_CONTEXT_FACTORY,
  NGXS_STATE_FACTORY,
  NgxsBootstrapper,
  StateClass
} from '@ngxs/store/internals';

import {
  FEATURE_STATE_TOKEN,
  NgxsConfig,
  NgxsModuleOptions,
  ROOT_STATE_TOKEN
} from './symbols';
import { NgxsExecutionStrategy, NGXS_EXECUTION_STRATEGY } from './execution/symbols';
import { StateFactory } from './internal/state-factory';
import { StateContextFactory } from './internal/state-context-factory';
import { Actions, InternalActions } from './actions-stream';
import { LifecycleStateManager } from './internal/lifecycle-state-manager';
import { InternalDispatchedActionResults, InternalDispatcher } from './internal/dispatcher';
import { InternalStateOperations } from './internal/state-operations';
import { Store } from './store';
import { StateStream } from './internal/state-stream';
import { PluginManager } from './plugin-manager';
import { NgxsRootModule } from './modules/ngxs-root.module';
import { NgxsFeatureModule } from './modules/ngxs-feature.module';
import { DispatchOutsideZoneNgxsExecutionStrategy } from './execution/dispatch-outside-zone-ngxs-execution-strategy';
import { NoopNgxsExecutionStrategy } from './execution/noop-ngxs-execution-strategy';
import { InternalNgxsExecutionStrategy } from './execution/internal-ngxs-execution-strategy';
import { mergeDeep } from './utils/utils';

/**
 * Ngxs Module
 */
@NgModule()
export class NgxsModule {
  private static readonly ROOT_OPTIONS = new InjectionToken<NgxsModuleOptions>('ROOT_OPTIONS');

  /**
   * Root module factory
   */
  public static forRoot(
    states: StateClass[] = [],
    options: NgxsModuleOptions = {}
  ): ModuleWithProviders<NgxsRootModule> {
    return {
      ngModule: NgxsRootModule,
      providers: [
        StateFactory,
        StateContextFactory,
        Actions,
        InternalActions,
        NgxsBootstrapper,
        LifecycleStateManager,
        InternalDispatcher,
        InternalDispatchedActionResults,
        InternalStateOperations,
        InternalNgxsExecutionStrategy,
        Store,
        StateStream,
        PluginManager,
        ...states,
        ...NgxsModule.ngxsTokenProviders(states, options)
      ]
    };
  }

  /**
   * Feature module factory
   */
  public static forFeature(states: StateClass[] = []): ModuleWithProviders<NgxsFeatureModule> {
    return {
      ngModule: NgxsFeatureModule,
      providers: [
        StateFactory,
        PluginManager,
        ...states,
        {
          provide: FEATURE_STATE_TOKEN,
          multi: true,
          useValue: states
        }
      ]
    };
  }

  private static ngxsTokenProviders(
    states: StateClass[],
    options: NgxsModuleOptions
  ): Provider[] {
    return [
      {
        provide: NGXS_EXECUTION_STRATEGY,
        useFactory: NgxsModule.ngxsExecutionStrategyFactory(options.executionStrategy),
        deps: [NgZone, Injector]
      },
      {
        provide: ROOT_STATE_TOKEN,
        useValue: states
      },
      {
        provide: NgxsModule.ROOT_OPTIONS,
        useValue: options
      },
      {
        provide: NgxsConfig,
        useFactory: NgxsModule.ngxsConfigFactory,
        deps: [NgxsModule.ROOT_OPTIONS]
      },
      {
        provide: APP_BOOTSTRAP_LISTENER,
        useFactory: NgxsModule.appBootstrapListenerFactory,
        multi: true,
        deps: [NgxsBootstrapper]
      },
      {
        provide: INITIAL_STATE_TOKEN,
        useFactory: NgxsModule.getInitialState
      },
      {
        provide: NGXS_STATE_CONTEXT_FACTORY,
        useExisting: StateContextFactory
      },
      {
        provide: NGXS_STATE_FACTORY,
        useExisting: StateFactory
      }
    ];
  }

  private static ngxsConfigFactory(options: NgxsModuleOptions): NgxsConfig {
    return mergeDeep(new NgxsConfig(), options);
  }

  private static appBootstrapListenerFactory(bootstrapper: NgxsBootstrapper): Function {
    return () => bootstrapper.bootstrap();
  }

  private static getInitialState() {
    return InitialState.pop();
  }

  private static ngxsExecutionStrategyFactory(
    executionStrategy: Type<NgxsExecutionStrategy> | undefined
  ) {
    return (ngZone: NgZone, injector: Injector) =>
      executionStrategy
        ? injector.get(executionStrategy)
        : injector.get(
            // `ngZone` might be an instanceof of `NgZone` either `NoopNgZone`. If the zone is nooped through
            // bootstrap options (`{ ngZone: 'noop' })`, then we have to provide `NoopNgxsExecutionStrategy`
            // explicitly. Providing `DispatchOutsideZoneNgxsExecutionStrategy` will cause a runtime exception
            // `Zone is not defined`, since the `Zone` global will not be exposed by zone.js.
            // The `DispatchOutsideZoneNgxsExecutionStrategy` uses `NgZone.isInAngularZone()` which tries to get
            // the current zone through `Zone.current` (this will cause a runtime exception).
            ngZone instanceof NgZone
              ? DispatchOutsideZoneNgxsExecutionStrategy
              : NoopNgxsExecutionStrategy
          );
  }
}
