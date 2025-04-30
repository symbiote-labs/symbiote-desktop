import AddPluginModal from './components/AddPluginModal'  // 新增导入

const ModuleSettings: FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)  // 新增状态

  // 处理添加插件
  const handleAddPlugin = async (pluginId: string) => {
    try {
      setDownloading((prev) => ({ ...prev, [pluginId]: true }))
      const success = await installPlugin(pluginId)
      if (success) {
        messageApi.success(`插件 ${pluginId} 安装成功`)
      } else {
        messageApi.error(`插件 ${pluginId} 安装失败`)
      }
    } catch (error) {
      console.error(`Failed to install plugin ${pluginId}:`, error)
      messageApi.error(`插件 ${pluginId} 安装失败`)
    } finally {
      setDownloading((prev) => ({ ...prev, [pluginId]: false }))
      setIsModalVisible(false)  // 安装完成后关闭弹窗
    }
  }

  return (
    {activeTab === 'plugins' && (
      <>
        <ActionBar>
          <Button 
            icon={<PlusOutlined />} 
            type="primary"
            onClick={() => setIsModalVisible(true)}  // 绑定点击事件
          >
            添加插件
          </Button>
        </ActionBar>

        {/* 新增模态框组件 */}
        <AddPluginModal 
          visible={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          onOk={handleAddPlugin}
        />
      </>
    )}
  )
}