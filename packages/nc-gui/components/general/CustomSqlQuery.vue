<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { useCustomSql } from '~/composables/useCustomSql'

withDefaults(
  defineProps<{
    hideCard?: boolean
  }>(),
  {
    hideCard: false,
  },
)

const { t } = useI18n()

const baseStore = useBase()
const { base, sources } = storeToRefs(baseStore)

const formState = ref({
  sqlQuery: '',
  sourceId: undefined as string | undefined,
})

const {
  executeQuery,
  isLoading,
  error,
  result,
  reset: resetComposable,
} = useCustomSql({
  baseId: computed(() => base.value?.id),
  sourceId: computed(() => formState.value.sourceId),
})

const handleExecute = async () => {
  if (!formState.value.sqlQuery?.trim()) {
    message.warning(t('activity.sqlQueryRequired') || 'SQL query is required')
    return
  }

  await executeQuery(formState.value.sqlQuery)
}

const reset = () => {
  formState.value.sqlQuery = ''
  formState.value.sourceId = undefined
  resetComposable()
}

// Generate table columns from result data
const tableColumns = computed(() => {
  if (!result.value || !result.value.data || result.value.data.length === 0) {
    return []
  }

  const firstRow = result.value.data[0]
  return Object.keys(firstRow).map((key) => ({
    title: key,
    dataIndex: key,
    key,
    ellipsis: true,
  }))
})

// Set default source if only one source exists
watch(
  sources,
  (newSources) => {
    if (newSources && newSources.length === 1 && !formState.value.sourceId) {
      formState.value.sourceId = newSources[0].id
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="nc-custom-sql-query">
    <a-card v-if="!hideCard" :title="t('activity.customSqlQuery') || 'Custom SQL Query'" class="nc-custom-sql-card">
      <template #extra>
        <NcButton type="text" size="small" :disabled="!result && !error" @click="reset">
          {{ t('general.reset') || 'Reset' }}
        </NcButton>
      </template>

      <div class="nc-sql-query-form">
        <a-form layout="vertical" :model="formState">
          <a-form-item :label="t('activity.sqlQuery') || 'SQL Query'" required>
            <div class="nc-sql-editor-wrapper">
              <a-textarea
                v-model:value="formState.sqlQuery"
                :rows="10"
                :placeholder="t('activity.enterSqlQuery') || 'Enter your SQL query here...'"
                class="nc-sql-textarea"
                style="font-family: 'Courier New', monospace; font-size: 14px"
              />
            </div>
          </a-form-item>

          <a-form-item v-if="sources && sources.length > 1" :label="t('activity.dataSource') || 'Data Source'">
            <NcSelect
              v-model:value="formState.sourceId"
              :placeholder="t('activity.selectDataSource') || 'Select data source'"
              class="nc-source-select"
            >
              <a-select-option v-for="source in sources" :key="source.id" :value="source.id">
                {{ source.alias || source.title || source.id }}
              </a-select-option>
            </NcSelect>
          </a-form-item>

          <a-form-item>
            <NcButton
              type="primary"
              class="nc-execute-btn"
              :loading="isLoading"
              :disabled="!formState.sqlQuery?.trim()"
              @click="handleExecute"
            >
              {{ t('activity.executeQuery') || 'Execute Query' }}
            </NcButton>
          </a-form-item>
        </a-form>
      </div>

      <a-divider v-if="error || result" />

      <div v-if="error" class="nc-error-container">
        <a-alert
          type="error"
          :message="t('activity.queryError') || 'Query Error'"
          :description="error"
          show-icon
          closable
          @close="reset"
        />
      </div>

      <div v-if="result" class="nc-result-container">
        <div class="nc-result-header">
          <span class="nc-result-count">
            {{ t('activity.queryResults') || 'Query Results' }}: {{ result.count }}
            {{ t('activity.rows') || 'rows' }}
          </span>
        </div>

        <div class="nc-result-table-wrapper">
          <a-table
            :data-source="result.data"
            :columns="tableColumns"
            :pagination="{
              pageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => t('activity.totalRows', { total }) || `Total ${total} rows`,
            }"
            :scroll="{ x: 'max-content' }"
            size="small"
            bordered
            class="nc-result-table"
          >
            <template #bodyCell="{ column, record }">
              <div class="nc-cell-content">
                <template v-if="record[column.dataIndex] === null">
                  <span class="nc-null-value">{{ t('activity.null') || 'NULL' }}</span>
                </template>
                <template v-else>
                  {{ record[column.dataIndex] }}
                </template>
              </div>
            </template>
          </a-table>
        </div>
      </div>
    </a-card>
    <div v-else class="nc-custom-sql-content">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">{{ t('activity.customSqlQuery') || 'Custom SQL Query' }}</h3>
        <NcButton type="text" size="small" :disabled="!result && !error" @click="reset">
          {{ t('general.reset') || 'Reset' }}
        </NcButton>
      </div>

      <div class="nc-sql-query-form">
        <a-form layout="vertical" :model="formState">
          <a-form-item :label="t('activity.sqlQuery') || 'SQL Query'" required>
            <div class="nc-sql-editor-wrapper">
              <a-textarea
                v-model:value="formState.sqlQuery"
                :rows="10"
                :placeholder="t('activity.enterSqlQuery') || 'Enter your SQL query here...'"
                class="nc-sql-textarea"
                style="font-family: 'Courier New', monospace; font-size: 14px"
              />
            </div>
          </a-form-item>

          <a-form-item v-if="sources && sources.length > 1" :label="t('activity.dataSource') || 'Data Source'">
            <NcSelect
              v-model:value="formState.sourceId"
              :placeholder="t('activity.selectDataSource') || 'Select data source'"
              class="nc-source-select"
            >
              <a-select-option v-for="source in sources" :key="source.id" :value="source.id">
                {{ source.alias || source.title || source.id }}
              </a-select-option>
            </NcSelect>
          </a-form-item>

          <a-form-item>
            <NcButton
              type="primary"
              class="nc-execute-btn"
              :loading="isLoading"
              :disabled="!formState.sqlQuery?.trim()"
              @click="handleExecute"
            >
              {{ t('activity.executeQuery') || 'Execute Query' }}
            </NcButton>
          </a-form-item>
        </a-form>
      </div>

      <a-divider v-if="error || result" />

      <div v-if="error" class="nc-error-container">
        <a-alert
          type="error"
          :message="t('activity.queryError') || 'Query Error'"
          :description="error"
          show-icon
          closable
          @close="reset"
        />
      </div>

      <div v-if="result" class="nc-result-container">
        <div class="nc-result-header">
          <span class="nc-result-count">
            {{ t('activity.queryResults') || 'Query Results' }}: {{ result.count }}
            {{ t('activity.rows') || 'rows' }}
          </span>
        </div>

        <div class="nc-result-table-wrapper">
          <a-table
            :data-source="result.data"
            :columns="tableColumns"
            :pagination="{
              pageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => t('activity.totalRows', { total }) || `Total ${total} rows`,
            }"
            :scroll="{ x: 'max-content' }"
            size="small"
            bordered
            class="nc-result-table"
          >
            <template #bodyCell="{ column, record }">
              <div class="nc-cell-content">
                <template v-if="record[column.dataIndex] === null">
                  <span class="nc-null-value">{{ t('activity.null') || 'NULL' }}</span>
                </template>
                <template v-else>
                  {{ record[column.dataIndex] }}
                </template>
              </div>
            </template>
          </a-table>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-custom-sql-query {
  .nc-custom-sql-card {
    .nc-sql-query-form {
      .nc-sql-editor-wrapper {
        .nc-sql-textarea {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          width: 100%;
        }
      }

      .nc-source-select {
        width: 100%;
      }

      .nc-execute-btn {
        margin-top: 8px;
      }
    }

    .nc-error-container {
      margin-top: 16px;
    }

    .nc-result-container {
      margin-top: 16px;

      .nc-result-header {
        margin-bottom: 12px;
        font-weight: 500;

        .nc-result-count {
          color: var(--nc-text-color);
        }
      }

      .nc-result-table-wrapper {
        overflow-x: auto;

        .nc-result-table {
          .nc-cell-content {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            .nc-null-value {
              color: var(--nc-text-color-secondary);
              font-style: italic;
            }
          }
        }
      }
    }
  }

  .nc-custom-sql-content {
    .nc-sql-query-form {
      .nc-sql-editor-wrapper {
        .nc-sql-textarea {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          width: 100%;
        }
      }

      .nc-source-select {
        width: 100%;
      }

      .nc-execute-btn {
        margin-top: 8px;
      }
    }

    .nc-error-container {
      margin-top: 16px;
    }

    .nc-result-container {
      margin-top: 16px;

      .nc-result-header {
        margin-bottom: 12px;
        font-weight: 500;

        .nc-result-count {
          color: var(--nc-text-color);
        }
      }

      .nc-result-table-wrapper {
        overflow-x: auto;

        .nc-result-table {
          .nc-cell-content {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            .nc-null-value {
              color: var(--nc-text-color-secondary);
              font-style: italic;
            }
          }
        }
      }
    }
  }
}
</style>
