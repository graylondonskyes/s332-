import { ILogger, MaybePromise } from '@theia/core';
import { AIVariable, AIVariableContext, AIVariableContribution, AIVariableResolutionRequest, AIVariableResolver, AIVariableService, ResolvedAIVariable } from '../common/variable-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { SkillService } from './skill-service';
export declare const SKILLS_VARIABLE: AIVariable;
export declare const SKILL_VARIABLE: AIVariable;
export interface SkillSummary {
    name: string;
    description: string;
    location: string;
}
export interface ResolvedSkillsVariable extends ResolvedAIVariable {
    skills: SkillSummary[];
}
export declare class SkillsVariableContribution implements AIVariableContribution, AIVariableResolver {
    protected readonly skillService: SkillService;
    protected readonly logger: ILogger;
    protected readonly fileService: FileService;
    registerVariables(service: AIVariableService): void;
    canResolve(request: AIVariableResolutionRequest, _context: AIVariableContext): MaybePromise<number>;
    resolve(request: AIVariableResolutionRequest, _context: AIVariableContext): Promise<ResolvedSkillsVariable | ResolvedAIVariable | undefined>;
    /**
     * Resolves skills into a ResolvedSkillsVariable with XML format.
     */
    resolveSkillsVariable(includedSkills: SkillSummary[], variable: AIVariable): ResolvedSkillsVariable;
    protected resolveSingleSkill(request: AIVariableResolutionRequest): Promise<ResolvedAIVariable | undefined>;
    /**
     * Generates XML representation of skills.
     * XML format follows the Agent Skills spec for structured skill representation.
     * This method is public to allow reuse by GenericCapabilitiesVariableContribution.
     */
    generateSkillsXML(skills: SkillSummary[]): string;
    protected escapeXml(text: string): string;
}
//# sourceMappingURL=skills-variable-contribution.d.ts.map