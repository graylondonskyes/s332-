import { LanguageModel, LanguageModelRegistry, LanguageModelResponse, UserRequest } from './language-model';
import { LanguageModelExchangeRequest, LanguageModelSession } from './language-model-interaction-model';
import { Emitter } from '@theia/core';
export interface RequestAddedEvent {
    type: 'requestAdded';
    id: string;
}
export interface ResponseCompletedEvent {
    type: 'responseCompleted';
    requestId: string;
}
export interface SessionsClearedEvent {
    type: 'sessionsCleared';
}
export type SessionEvent = RequestAddedEvent | ResponseCompletedEvent | SessionsClearedEvent;
export declare const LanguageModelService: unique symbol;
export interface LanguageModelService {
    onSessionChanged: Emitter<SessionEvent>['event'];
    /**
     * Collection of all recorded LanguageModelSessions.
     */
    sessions: LanguageModelSession[];
    /**
     * Submit a language model request, it will automatically be recorded within a LanguageModelSession.
     */
    sendRequest(languageModel: LanguageModel, languageModelRequest: UserRequest): Promise<LanguageModelResponse>;
}
export declare class LanguageModelServiceImpl implements LanguageModelService {
    protected languageModelRegistry: LanguageModelRegistry;
    private _sessions;
    get sessions(): LanguageModelSession[];
    set sessions(newSessions: LanguageModelSession[]);
    protected sessionChangedEmitter: any;
    onSessionChanged: any;
    sendRequest(languageModel: LanguageModel, languageModelRequest: UserRequest): Promise<LanguageModelResponse>;
    protected storeRequest(languageModel: LanguageModel, languageModelRequest: UserRequest, response: LanguageModelExchangeRequest['response']): void;
}
//# sourceMappingURL=language-model-service.d.ts.map