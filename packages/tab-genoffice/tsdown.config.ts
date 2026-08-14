/**
 * Build config for the tab-genoffice package (adapter over the workspace's shared
 * tsdown preset; the loader id matches the profile row's package name).
 */
import { packageTsdownConfig } from '../../tsdown.preset.ts'

export default packageTsdownConfig('@deepseek-ai/dsh-tab-genoffice')
