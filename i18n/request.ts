import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // Dynamically import and merge messages for the current locale
  const aiTeamFactoryMessages = (await import(`../messages/${locale}/ai-team-factory.json`)).default;
  const tiptapEditorMessages = (await import(`../messages/${locale}/tiptap_editor.json`)).default;
  const specialCapabilityMessages = (await import(`../messages/${locale}/special-capability.json`)).default;
  const pagesMessages = (await import(`../messages/${locale}/pages.json`)).default;
  const settingsMessages = (await import(`../messages/${locale}/settings.json`)).default;
  const knowledgeMessages = (await import(`../messages/${locale}/knowledge.json`)).default;
  const requirementMessages = (await import(`../messages/${locale}/requirement.json`)).default;
  const testMessages = (await import(`../messages/${locale}/test.json`)).default;
  const layoutMessages = (await import(`../messages/${locale}/layout.json`)).default;

  const messages = {
    ...aiTeamFactoryMessages,
    ...tiptapEditorMessages,
    ...specialCapabilityMessages,
    ...pagesMessages,
    ...settingsMessages,
    ...knowledgeMessages,
    ...requirementMessages,
    ...testMessages,
    ...layoutMessages,
  };

  return {
    locale,
    messages
  };
}); 