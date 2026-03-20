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
import {Injectable, NgZone} from '@angular/core';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {URLUtil} from '../../../utils/url-util';
import {AgentRunRequest} from '../models/AgentRunRequest';
import {LlmResponse} from '../models/types';
import {AgentService as AgentServiceInterface} from './interfaces/agent';
import {VertexAuthService, VertexConfig} from './vertex-auth.service';
import {VERTEX_CONFIG} from '../../injection_tokens';
import {Inject} from '@angular/core';
import {switchMap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AgentService implements AgentServiceInterface {
  apiServerDomain = URLUtil.getApiServerBaseUrl();
  private get baseUrl() {
    return `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.project}/locations/${this.config.location}/reasoningEngines/${this.config.reasoningEngineId}`;
  }
  private _currentApp = new BehaviorSubject<string>('');
  currentApp = this._currentApp.asObservable();
  private isLoading = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private zone: NgZone,
    private authService: VertexAuthService,
    @Inject(VERTEX_CONFIG) private config: VertexConfig
  ) {}

  getApp(): Observable<string> {
    return this.currentApp;
  }

  setApp(name: string) {
    this._currentApp.next(name);
  }

  getLoadingState(): BehaviorSubject<boolean> {
    return this.isLoading;
  }

  runSse(req: AgentRunRequest): Observable<LlmResponse> {
    this.isLoading.next(true);
    return this.authService.getAccessToken().pipe(
      switchMap(token => new Observable<LlmResponse>((observer) => {
        const url = `${this.baseUrl}:streamQuery?alt=sse`;
        const body = {
          class_method: 'async_stream_query',
          input: {
            user_id: req.userId,
            session_id: req.sessionId,
            message: req.newMessage.parts[0].text || {
              role: req.newMessage.role,
              content: {
                parts: req.newMessage.parts.map(p => {
                  const part: any = { ...p };
                  if (p.functionCall) {
                    part.function_call = p.functionCall;
                    delete part.functionCall;
                  }
                  if (p.functionResponse) {
                    part.function_response = p.functionResponse;
                    delete p.functionResponse;
                  }
                  return part;
                })
              }
            }
          }
        };

        fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify(body),
        })
          .then((response) => {
            console.log('Vertex AI fetch status:', response.status);
            if (!response.ok) {
              console.error('Vertex AI request failed:', response.statusText);
              this.zone.run(() => observer.error(`HTTP error ${response.status}`));
              return;
            }
            const reader = response.body?.getReader();
            const decoder = new TextDecoder('utf-8');
            let lastData = '';
            const streamId = `stream-${Date.now()}`;

            const read = () => {
              reader?.read()
                  .then(({done, value}) => {
                    this.isLoading.next(true);
                    if (done) {
                      this.isLoading.next(false);
                      return observer.complete();
                    }
                    lastData += decoder.decode(value, {stream: true});
                    console.log('Receiving raw chunk:', lastData);
                    let lines = lastData.split(/\r?\n/);
                    lastData = lines.pop() || ''; // Keep the partial line for next chunk

                    lines.forEach((line) => {
                      line = line.trim();
                      if (!line) return;

                      let dataStr = line;
                      if (line.startsWith('data:')) {
                        dataStr = line.substring(5).trim();
                      }

                      if (dataStr && dataStr !== '[DONE]') {
                        try {
                          const parsed = JSON.parse(dataStr);
                          const content = parsed.content || (parsed.output ? parsed.output.content : null);

                          if (content) {
                            const parts = (content.parts || []).map((part: any) => {
                              const newPart: any = { ...part };
                              if (part.function_call) {
                                newPart.functionCall = part.function_call;
                                delete newPart.function_call;
                              }
                              if (part.function_response) {
                                newPart.functionResponse = part.function_response;
                                delete newPart.function_response;
                              }
                              if (part.executable_code) {
                                newPart.executableCode = part.executable_code;
                                delete newPart.executable_code;
                              }
                              if (part.code_execution_result) {
                                newPart.codeExecutionResult = part.code_execution_result;
                                delete part.code_execution_result;
                              }
                              return newPart;
                            });

                            const event: any = {
                              id: parsed.id || streamId,
                              author: parsed.author === req.userId ? 'user' : 'bot',
                              content: {
                                role: content.role,
                                parts: parts
                              },
                              partial: true
                            };
                            console.log('Emitting ADK Event to UI:', event);
                            this.zone.run(() => observer.next(event));
                          }
                        } catch (e) {
                          if (dataStr.startsWith('{')) {
                            console.error('JSON parse error or invalid chunk:', dataStr, e);
                          }
                        }
                      }
                    });
                    read();
                  })
                  .catch((err) => {
                    this.zone.run(() => observer.error(err));
                  });
            };

            read();
          })
          .catch((err) => {
            this.zone.run(() => observer.error(err));
          });
      }))
    );
  }

  listApps(): Observable<string[]> {
    const name = this.config.agentName || this.config.reasoningEngineId;
    return of(name ? [name] : []);
  }

  agentBuild(req: any): Observable<boolean> {
    if (this.apiServerDomain != undefined) {
      const url =
        this.apiServerDomain + `/builder/save`;
      return this.http.post<any>(url, req);
    }
    return new Observable<false>();
  }

  agentBuildTmp(req: any): Observable<boolean> {
    if (this.apiServerDomain != undefined) {
      const url =
        this.apiServerDomain + `/builder/save?tmp=true`;
      return this.http.post<any>(url, req);
    }
    return new Observable<false>();
  }

  getAgentBuilder(appName: string): Observable<string> {
    if (this.apiServerDomain != undefined) {
      const url = this.apiServerDomain + `/builder/load?app_name=${appName}`;
      return this.http.get<string>(url);
    }
    return new Observable<''>();
  }

  getAgentBuilderTmp(appName: string): Observable<string> {
    if (this.apiServerDomain != undefined) {
      const url =
        this.apiServerDomain + `/builder/load?app_name=${appName}&tmp=true`;
      return this.http.get<string>(url);
    }
    return new Observable<''>();
  }

  agentChangeCancel(appName: string) {
    if (this.apiServerDomain != undefined) {
      const url =
        this.apiServerDomain + `/builder/cancel?app_name=${appName}`;
      return this.http.get<any>(url);
    }
    return new Observable<undefined>();
  }

  getAppInfo(appName: string): Observable<any> {
    if (this.apiServerDomain != undefined) {
      const url = this.apiServerDomain + `/apps/${appName}`;
      return this.http.get<any>(url);
    }
    return new Observable<any>();
  }

  getSubAgentBuilder(appName: string, relativePath: string): Observable<string> {
    if (this.apiServerDomain != undefined) {
      const url = this.apiServerDomain +
          `/builder/load?app_name=${appName}&relative_path=${relativePath}`;
      return this.http.get<string>(url);
    }
    return new Observable<''>();
  }
}
