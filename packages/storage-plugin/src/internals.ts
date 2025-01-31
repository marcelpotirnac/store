import { isPlatformServer } from '@angular/common';
import { StateClass } from '@ngxs/store/internals';
import { StateToken } from '@ngxs/store';

import { StorageOption, StorageEngine, NgxsStoragePluginOptions } from './symbols';

/**
 * @description Will be provided through Terser global definitions by Angular CLI
 * during the production build. This is how Angular does tree-shaking internally.
 */
declare const ngDevMode: boolean;

/**
 * If the `key` option is not provided then the below constant
 * will be used as a default key
 */
export const DEFAULT_STATE_KEY = '@@STATE';

/**
 * Internal type definition for the `key` option provided
 * in the `forRoot` method when importing module
 */
export type StorageKey =
  | string
  | StateClass
  | StateToken<any>
  | (string | StateClass | StateToken<any>)[];

/**
 * This key is used to retrieve static metadatas on state classes.
 * This constant is taken from the core codebase
 */
const META_OPTIONS_KEY = 'NGXS_OPTIONS_META';

function transformKeyOption(key: StorageKey): string[] {
  if (!Array.isArray(key)) {
    key = [key];
  }

  return key.map((token: string | StateClass | StateToken<any>) => {
    // If it has the `NGXS_OPTIONS_META` key then it means the developer
    // has provided state class like `key: [AuthState]`.
    if (token.hasOwnProperty(META_OPTIONS_KEY)) {
      // The `name` property will be an actual state name or a `StateToken`.
      token = (token as any)[META_OPTIONS_KEY].name;
    }

    return token instanceof StateToken ? token.getName() : (token as string);
  });
}

export function storageOptionsFactory(
  options: NgxsStoragePluginOptions | undefined
): NgxsStoragePluginOptions {
  if (options !== undefined && options.key) {
    options.key = transformKeyOption(options.key);
  }

  return {
    key: [DEFAULT_STATE_KEY],
    storage: StorageOption.LocalStorage,
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    beforeSerialize: obj => obj,
    afterDeserialize: obj => obj,
    ...options
  };
}

export function engineFactory(
  options: NgxsStoragePluginOptions,
  platformId: string
): StorageEngine | null {
  if (isPlatformServer(platformId)) {
    return null;
  }

  try {
    if (options.storage === StorageOption.LocalStorage) {
      return localStorage;
    } else if (options.storage === StorageOption.SessionStorage) {
      return sessionStorage;
    }
  } catch (error) {
    // Caretaker note: we have still left the `typeof` condition in order to avoid
    // creating a breaking change for projects that still use the View Engine.
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      console.warn(
        `${
          options.storage === StorageOption.LocalStorage ? 'localStorage' : 'sessionStorage'
        } is not available!`,
        error
      );
    }
  }

  return null;
}
