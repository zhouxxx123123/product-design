import { Client } from './clients';

export interface ClientExportData {
  companyName: string;
  industry: string;
  size: string;
  status: string;
  primaryContact: string;
  phone: string;
  email: string;
  tags: string;
  notes: string;
  lastInteraction: string;
  createdAt: string;
}

export const clientExportService = {
  /**
   * Convert client data to CSV format and trigger download
   */
  exportToCSV: (clients: Client[], filename: string = 'clients_export') => {
    const headers = [
      '公司名称',
      '行业',
      '规模',
      '状态',
      '主要联系人',
      '电话',
      '邮箱',
      '标签',
      '备注',
      '最后互动',
      '创建时间'
    ];

    const rows = clients.map(client => {
      const primaryContact = client.contacts?.[0];
      return [
        client.companyName || '',
        client.industry || '',
        client.size || '',
        client.status || '',
        primaryContact?.name || '',
        primaryContact?.phone || '',
        primaryContact?.email || '',
        client.tags?.join(', ') || '',
        client.notes || '',
        client.lastInteraction || '',
        new Date(client.createdAt).toLocaleString('zh-CN')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Convert client data to Excel format and trigger download
   */
  exportToExcel: (clients: Client[], filename: string = 'clients_export') => {
    // For now, we'll use CSV format but with .xlsx extension
    // In a real implementation, you might use a library like xlsx or exceljs
    const headers = [
      '公司名称',
      '行业',
      '规模',
      '状态',
      '主要联系人',
      '电话',
      '邮箱',
      '标签',
      '备注',
      '最后互动',
      '创建时间'
    ];

    const rows = clients.map(client => {
      const primaryContact = client.contacts?.[0];
      return [
        client.companyName || '',
        client.industry || '',
        client.size || '',
        client.status || '',
        primaryContact?.name || '',
        primaryContact?.phone || '',
        primaryContact?.email || '',
        client.tags?.join(', ') || '',
        client.notes || '',
        client.lastInteraction || '',
        new Date(client.createdAt).toLocaleString('zh-CN')
      ];
    });

    // Create CSV content with UTF-8 BOM for Excel compatibility
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xlsx`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};