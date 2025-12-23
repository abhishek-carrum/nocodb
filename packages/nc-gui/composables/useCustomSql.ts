import type { Ref } from 'vue'
import { message } from 'ant-design-vue'

export interface CustomSqlResult {
  data: any[]
  count: number
}

export interface UseCustomSqlOptions {
  baseId?: string | Ref<string>
  sourceId?: string | Ref<string>
}

export function useCustomSql(options: UseCustomSqlOptions = {}) {
  const { api } = useApi()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const result = ref<CustomSqlResult | null>(null)

  const executeQuery = async (sqlQuery: string): Promise<CustomSqlResult | null> => {
    if (!sqlQuery || !sqlQuery.trim()) {
      error.value = 'SQL query is required'
      message.error('SQL query is required')
      return null
    }

    const baseId = unref(options.baseId)
    if (!baseId) {
      error.value = 'Base ID is required'
      message.error('Base ID is required')
      return null
    }

    isLoading.value = true
    error.value = null
    result.value = null

    try {
      const sourceId = unref(options.sourceId)
      const params: Record<string, string> = {
        sql: sqlQuery,
      }

      if (sourceId) {
        params.sourceId = sourceId
      }

      const response = await api.instance.get(`/api/v2/bases/${baseId}/custom-sql`, {
        params,
      })

      const responseData = response.data as CustomSqlResult
      result.value = responseData
      error.value = null

      return responseData
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'An error occurred while executing the query'
      error.value = errorMsg
      result.value = null
      message.error(errorMsg)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const reset = () => {
    error.value = null
    result.value = null
    isLoading.value = false
  }

  return {
    executeQuery,
    isLoading: readonly(isLoading),
    error: readonly(error),
    result: readonly(result),
    reset,
  }
}
