/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Inject, Injectable} from '@angular/core';
import {from, Observable, of} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';
import {VERTEX_CONFIG} from '../../injection_tokens';

export interface VertexConfig {
  backendMode: string;
  project: string;
  location: string;
  reasoningEngineId: string;
  serviceAccountKey: {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
    universe_domain: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class VertexAuthService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(@Inject(VERTEX_CONFIG) private config: VertexConfig) {}

  getAccessToken(): Observable<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.tokenExpiry > now + 60) {
      return of(this.accessToken);
    }

    return from(this.generateAccessToken()).pipe(
      tap((tokenData: any) => {
        this.accessToken = tokenData.access_token;
        this.tokenExpiry = now + tokenData.expires_in;
      }),
      map((tokenData: any) => tokenData.access_token)
    );
  }

  private async generateAccessToken(): Promise<any> {
    const sa = this.config.serviceAccountKey;
    const now = Math.floor(Date.now() / 1000);
    const scope = 'https://www.googleapis.com/auth/cloud-platform';

    const header = btoa(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
    const payload = btoa(JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));

    const signingInput = `${header}.${payload}`;
    const privateKey = await this.importPrivateKey(sa.private_key);
    const signatureBuffer = await crypto.subtle.sign(
      {name: 'RSASSA-PKCS1-v1_5'},
      privateKey,
      new TextEncoder().encode(signingInput)
    );

    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    const jwt = `${signingInput}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(`Failed to generate access token: ${JSON.stringify(error)}`);
    }

    return await res.json();
  }

  private async importPrivateKey(pem: string): Promise<CryptoKey> {
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
      'pkcs8',
      binaryDer.buffer,
      {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'},
      false,
      ['sign']
    );
  }
}
