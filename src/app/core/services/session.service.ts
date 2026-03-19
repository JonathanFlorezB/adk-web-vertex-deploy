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

import {HttpClient} from '@angular/common/http';
import {Injectable, InjectionToken} from '@angular/core';
import {Observable, of} from 'rxjs';
import {map} from 'rxjs/operators';

import {URLUtil} from '../../../utils/url-util';
import {Session} from '../models/Session';

import {ListResponse, SessionService as SessionServiceInterface} from './interfaces/session';
import {VertexAuthService, VertexConfig} from './vertex-auth.service';
import {VERTEX_CONFIG} from '../../injection_tokens';
import {Inject} from '@angular/core';
import {from} from 'rxjs';
import {switchMap, tap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SessionService implements SessionServiceInterface {
  private get baseUrl() {
    return `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.project}/locations/${this.config.location}/reasoningEngines/${this.config.reasoningEngineId}`;
  }

  constructor(
    private http: HttpClient,
    private authService: VertexAuthService,
    @Inject(VERTEX_CONFIG) private config: VertexConfig
  ) {}

  private getHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  createSession(userId: string, appName: string) {
    return this.authService.getAccessToken().pipe(
      switchMap(token => {
        const url = `${this.baseUrl}/sessions`;
        return this.http.post<any>(url, { userId }, {
          headers: this.getHeaders(token)
        }).pipe(
          switchMap(operation => this.waitForOperation(operation.name, token))
        );
      })
    );
  }

  private async waitForOperation(opName: string, token: string): Promise<Session> {
    const url = `https://${this.config.location}-aiplatform.googleapis.com/v1/${opName}`;
    while (true) {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const op = await res.json();
      if (op.done) {
        if (op.error) {
          throw new Error(`Session creation failed: ${op.error.message}`);
        }
        return this.mapVertexSessionToSession(op.response);
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  private mapVertexSessionToSession(s: any): Session {
    if (!s) return s;
    const session: any = { ...s };
    if (!session.id && session.name) {
      session.id = session.name.split('/').pop();
    }
    // Map Vertex AI history to events
    if (session.history && !session.events) {
      session.events = session.history.map((h: any, i: number) => ({
        id: `hist_${i}`,
        author: h.role, // role is "user" or "model"
        content: {
          role: h.role,
          parts: h.parts ? h.parts.map((p: any) => {
            const newPart: any = { ...p };
            if (p.function_call) {
              newPart.functionCall = p.function_call;
              delete newPart.function_call;
            }
            if (p.function_response) {
              newPart.functionResponse = p.function_response;
              delete newPart.function_response;
            }
            return newPart;
          }) : []
        }
      }));
    }
    return session as Session;
  }

  listSessions(userId: string, appName: string):
      Observable<ListResponse<Session>> {
    return this.authService.getAccessToken().pipe(
      switchMap(token => {
        const url = `${this.baseUrl}/sessions?filter=user_id="${userId}"`;
        return this.http.get<any>(url, {
          headers: this.getHeaders(token)
        }).pipe(map((res) => {
          const sessions = (res.sessions || []) as any[];
          return {
            items: sessions.map(s => this.mapVertexSessionToSession(s)),
            nextPageToken: res.nextPageToken || '',
          };
        }));
      })
    );
  }

  deleteSession(userId: string, appName: string, sessionId: string) {
    return this.authService.getAccessToken().pipe(
      switchMap(token => {
        const url = `${this.baseUrl}/sessions/${sessionId}`;
        return this.http.delete<any>(url, {
          headers: this.getHeaders(token)
        });
      })
    );
  }

  getSession(userId: string, appName: string, sessionId: string) {
    return this.authService.getAccessToken().pipe(
      switchMap(token => {
        const url = `${this.baseUrl}/sessions/${sessionId}/events`;
        return this.http.get<any>(url, {
          headers: this.getHeaders(token)
        }).pipe(map(res => {
          const vertexEvents = res.sessionEvents || res.events || [];
          console.log('Session History Response:', res);
          const session: any = { id: sessionId, events: [], state: {} };

          session.events = vertexEvents.map((ve: any) => {
            if (!ve.content) return null;
            const eventId = ve.name ? ve.name.split('/').pop() : `event_${Math.random()}`;
            
            return {
              id: eventId,
              author: ve.author === userId ? 'user' : 'bot',
              content: {
                role: ve.content.role,
                parts: ve.content.parts ? ve.content.parts.map((p: any) => {
                  const newPart: any = { ...p };
                  if (p.functionCall) {
                    newPart.functionCall = p.functionCall;
                  }
                  if (p.function_call) {
                    newPart.functionCall = p.function_call;
                    delete newPart.function_call;
                  }
                  if (p.functionResponse) {
                    newPart.functionResponse = p.functionResponse;
                  }
                  if (p.function_response) {
                    newPart.functionResponse = p.function_response;
                    delete newPart.function_response;
                  }
                  return newPart;
                }) : []
              }
            };
          }).filter((e: any) => e !== null);

          return session as Session;
        }));
      })
    );
  }

  importSession(userId: string, appName: string, events: any[]) {
    return this.authService.getAccessToken().pipe(
      switchMap(token => {
        const url = `${this.baseUrl}/sessions`;
        return this.http.post<Session>(url, { userId, events }, {
          headers: this.getHeaders(token)
        });
      })
    );
  }

  canEdit(userId: string, session: Session): Observable<boolean> {
    return of(true);
  }
}
