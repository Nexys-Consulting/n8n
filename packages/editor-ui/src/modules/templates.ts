import { getCategories, getCollectionById, getCollections, getTemplateById, getWorkflows } from '@/api/templates';
import { ActionContext, Module } from 'vuex';
import {
	IRootState,
	IN8nCollectionResponse,
	IN8nCollection,
	IN8nSearchResponse,
	IN8nSearchData,
	IN8nTemplate,
	IN8nTemplateResponse,
	ITemplateCategory,
	ITemplateCollection,
	ITemplateState,
	ITemplatesQuery,
} from '../Interface';

import Vue from 'vue';

const TEMPLATES_PAGE_SIZE = 10;

const module: Module<ITemplateState, IRootState> = {
	namespaced: true,
	state: {
		categories: {},
		collections: {},
		templates: {},
		collectionSearches: {},
		workflowSearches: {},
	},
	getters: {
		allCategories(state: ITemplateState) {
			return Object.values(state.categories);
		},
		getTemplateById(state: ITemplateState) {
			return (id: string): null | IN8nTemplate => state.templates[id];
		},
		getCollectionById(state: ITemplateState) {
			return (id: string): null | ITemplateCollection => state.collections[id];
		},
		getCategoryById(state: ITemplateState) {
			return (id: string): null | ITemplateCategory => state.categories[id];
		},
		getSearchedCollections(state: ITemplateState) {
			return (query: ITemplatesQuery) => {
				const searchKey = JSON.stringify(query);
				const search = state.collectionSearches[searchKey];
				if (!search) {
					return [];
				}

				return search.collectionIds.map((collectionId: string) => state.collections[collectionId]);
			};
		},
		getSearchedWorkflows(state: ITemplateState) {
			return (searchQuery: ITemplatesQuery) => {
				const query: ITemplatesQuery = {
					categories: searchQuery.categories,
					search: searchQuery.search,
				};
				const searchKey = JSON.stringify(query);
				const search = state.workflowSearches[searchKey];
				if (!search) {
					return [];
				}

				return search.workflowIds.map((workflowId: string) => state.templates[workflowId]);
			};
		},
		getSearchedWorkflowsTotal(state: ITemplateState) {
			return (searchQuery: ITemplatesQuery) => {
				const query: ITemplatesQuery = {
					categories: searchQuery.categories,
					search: searchQuery.search,
				};
				const searchKey = JSON.stringify(query);
				const search = state.workflowSearches[searchKey];

				return search ? search.totalWorkflows : 0;
			};
		},
	},
	mutations: {
		addCategories(state: ITemplateState, categories: ITemplateCategory[]) {
			categories.forEach((category: ITemplateCategory) => {
				Vue.set(state.categories, category.id, category);
			});
		},
		addCollections(state: ITemplateState, collections: ITemplateCollection[]) {
			collections.forEach((collection: ITemplateCollection) => {
				const cachedCollection = state.collections[collection.id] || {};
				Vue.set(state.collections, collection.id, {
					...cachedCollection,
					...collection,
				});
			});
		},
		addWorkflows(state: ITemplateState, workflows: IN8nTemplate[]) {
			workflows.forEach((workflow: IN8nTemplate) => {
				const cachedWorkflow = state.templates[workflow.id] || {};
				Vue.set(state.templates, workflow.id, {
					...cachedWorkflow,
					...workflow,
				});
			});
		},
		addCollectionSearch(state: ITemplateState, data: {collections: ITemplateCollection[], query: ITemplatesQuery}) {
			const collectionIds = data.collections.map((collection) => collection.id);
			const searchKey = JSON.stringify(data.query);
			Vue.set(state.collectionSearches, searchKey, {
				collectionIds,
			});
		},
		addWorkflowsSearch(state: ITemplateState, data: {totalWorkflows: number; workflows: IN8nTemplate[], searchQuery: ITemplatesQuery}) {
			const workflowIds = data.workflows.map((workflow) => workflow.id);
			const query: ITemplatesQuery = {
				categories: data.searchQuery.categories,
				search: data.searchQuery.search,
			};

			const searchKey = JSON.stringify(query);
			const cachedResults = state.workflowSearches[searchKey];
			if (!cachedResults) {
				Vue.set(state.workflowSearches, searchKey, {
					workflowIds,
					totalWorkflows: data.totalWorkflows,
				});

				return;
			}

			Vue.set(state.workflowSearches, searchKey, {
				workflowIds: [...cachedResults.workflowIds, ...workflowIds],
				totalWorkflows: data.totalWorkflows,
			});
		},
	},
	actions: {
		async getTemplateById(context: ActionContext<ITemplateState, IRootState>, templateId: string): Promise<IN8nTemplate> {
			const apiEndpoint: string = context.rootGetters['settings/templatesHost'];
			const response = await getTemplateById(apiEndpoint, templateId);
			const template: IN8nTemplate = response.data.workflow;

			context.commit('addWorkflows', [template]);
			return template;
		},
		async getCollectionById(context: ActionContext<ITemplateState, IRootState>, collectionId: string): Promise<IN8nCollection> {
			const apiEndpoint: string = context.rootGetters['settings/templatesHost'];
			const response = await getCollectionById(apiEndpoint, collectionId);
			const collection: IN8nCollection = response.data.collection;

			context.commit('addCollections', [collection]);
			return collection;
		},
		async getCategories(context: ActionContext<ITemplateState, IRootState>): Promise<ITemplateCategory[]> {
			const apiEndpoint: string = context.rootGetters['settings/templatesHost'];
			const response = await getCategories(apiEndpoint);
			const categories = response.data.categories;

			context.commit('addCategories', categories);

			return categories;
		},
		async getCollections(context: ActionContext<ITemplateState, IRootState>, query: ITemplatesQuery): Promise<IN8nCollection[]> {
			const cachedResults: IN8nCollection[] | null = context.getters.getSearchedCollections(query);
			if (cachedResults && cachedResults.length) {
				return cachedResults;
			}

			const apiEndpoint: string = context.rootGetters['settings/templatesHost'];
			const response = await getCollections(apiEndpoint, query);
			const collections = response.data.collections;

			context.commit('addCollections', collections);
			context.commit('addCollectionSearch', {query, collections});

			return collections;
		},
		async getWorkflows(context: ActionContext<ITemplateState, IRootState>, query: ITemplatesQuery): Promise<IN8nTemplate[]> {
			const cachedResults: IN8nTemplate[] = context.getters.getSearchedWorkflows(query);
			if (cachedResults && cachedResults.length) {
				return cachedResults;
			}

			const apiEndpoint: string = context.rootGetters['settings/templatesHost'];

			const payload = await getWorkflows(apiEndpoint, {...query, skip: 0, limit: TEMPLATES_PAGE_SIZE});

			context.commit('addWorkflows', payload.data.workflows);
			context.commit('addWorkflowsSearch', {...payload.data, searchQuery: query});

			return context.getters.getSearchedWorkflows(query);
		},
		async getMoreWorkflows(context: ActionContext<ITemplateState, IRootState>, query: ITemplatesQuery): Promise<IN8nTemplate[]> {
			const cachedResults: IN8nTemplate[] = context.getters.getSearchedWorkflows(query);
			const apiEndpoint: string = context.rootGetters['settings/templatesHost'];

			const payload = await getWorkflows(apiEndpoint, {...query, skip: cachedResults.length, limit: TEMPLATES_PAGE_SIZE});

			context.commit('addWorkflows', payload.data.workflows);
			context.commit('addWorkflowsSearch', {...payload.data, searchQuery: query});

			return context.getters.getSearchedWorkflows(query);
		},
	},
};

export default module;
