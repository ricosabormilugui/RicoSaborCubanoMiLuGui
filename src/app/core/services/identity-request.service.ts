import { Injectable } from '@angular/core';
import { ActiveIdentityService } from './active-identity.service';

@Injectable({ providedIn: 'root' })
export class IdentityRequestService {
  constructor(private readonly identity: ActiveIdentityService) {}
  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const session = this.identity.session();
    const check = () => this.identity.assertCurrent(session);
    try {
      const response = await fetch(input, { ...init, cache: 'no-store' });
      check();
      // Headers and body may finish in different sessions. Guard both, including errors.
      return new Proxy(response, { get(target, property) {
        const value = Reflect.get(target, property, target);
        if (['json', 'text', 'arrayBuffer', 'blob', 'formData'].includes(String(property))) return async () => {
          check();
          try { const body = await value.call(target); check(); return body; }
          catch (error) { check(); throw error; }
        };
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    } catch (error) { check(); throw error; }
  }
}
