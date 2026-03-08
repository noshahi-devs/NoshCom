import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Toast } from '../../../core/models/toast.interface';
import { Chart, registerables } from 'chart.js';

type ChartContext = {
  dataset: {
    label: string;
  };
  raw: number;
};

interface Transaction {
  id: number;
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  status: 'completed' | 'pending' | 'failed';
  reference: string;
}

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './finance.component.html',
  styleUrls: ['./finance.component.scss']
})
export class FinanceComponent implements OnInit {
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  searchTerm = '';
  typeFilter = 'all';
  statusFilter = 'all';
  dateRange = 'thisMonth';
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  showAddModal = false;
  transactionForm: FormGroup;
  toast: Toast | null = null;
  chart: Chart | null = null;
  
  // Summary data
  totalIncome = 0;
  totalExpense = 0;
  netBalance = 0;

  constructor(private fb: FormBuilder) {
    Chart.register(...registerables);
    this.transactionForm = this.fb.group({
      date: [new Date().toISOString().split('T')[0], Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      type: ['expense', Validators.required],
      category: ['', Validators.required],
      status: ['completed', Validators.required],
      reference: ['']
    });
  }

  ngOnInit(): void {
    this.loadTransactions();
    this.initializeChart();
  }

  loadTransactions(): void {
    // Mock data - replace with actual API call
    this.transactions = [
      {
        id: 1,
        date: new Date('2023-06-15'),
        description: 'Product Sales',
        amount: 12500,
        type: 'income',
        category: 'Sales',
        status: 'completed',
        reference: 'INV-2023-001'
      },
      // Add more mock transactions as needed
    ];
    
    this.calculateSummary();
    this.filterTransactions();
  }

  calculateSummary(): void {
    this.totalIncome = this.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    this.totalExpense = this.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    this.netBalance = this.totalIncome - this.totalExpense;
  }

  filterTransactions(): void {
    this.filteredTransactions = this.transactions.filter(transaction => {
      const matchesSearch = transaction.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                         transaction.reference?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesType = this.typeFilter === 'all' || transaction.type === this.typeFilter;
      const matchesStatus = this.statusFilter === 'all' || transaction.status === this.statusFilter;
      
      // Date filtering logic would go here
      
      return matchesSearch && matchesType && matchesStatus;
    });
    
    this.totalItems = this.filteredTransactions.length;
    this.currentPage = 1;
    this.updateChart();
  }

  initializeChart(): void {
    const ctx = document.getElementById('financeChart') as HTMLCanvasElement;
    if (ctx) {
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Income',
              data: [12000, 15000, 18000, 14000, 16000, 20000],
              backgroundColor: '#10B981',
              borderRadius: 4
            },
            {
              label: 'Expenses',
              data: [8000, 9000, 10000, 8500, 9500, 12000],
              backgroundColor: '#EF4444',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: {
                display: false
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                display: true,
                drawOnChartArea: true,
                drawTicks: false
              },
              border: {
                display: false,
                dash: [5, 5]
              },
              ticks: {
                callback: (value: string | number) => '$' + value
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
            },
            tooltip: {
              callbacks: {
                label: (tooltipItem: any) => {
                  const label = tooltipItem.dataset.label || '';
                  const value = tooltipItem.raw?.toLocaleString() || '0';
                  return `${label}: $${value}`;
                }
              }
            }
          }
        }
      });
    }
  }

  updateChart(): void {
    // Update chart data based on filtered transactions
    // This is a simplified example - you'd want to group by date/category
    if (this.chart) {
      // Update chart data here
      this.chart.update();
    }
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  getPageNumbers(): number[] {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    return Array.from({ length: totalPages }, (_, i: number) => i + 1);
  }

  get paginatedTransactions(): Transaction[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredTransactions.slice(startIndex, startIndex + this.itemsPerPage);
  }

  openAddModal(): void {
    this.showAddModal = true;
  }

  closeModal(): void {
    this.showAddModal = false;
    this.transactionForm.reset({
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      status: 'completed'
    });
  }

  saveTransaction(): void {
    if (this.transactionForm.invalid) {
      this.showToast('Please fill all required fields correctly', 'error');
      return;
    }

    // Simulate API call
    setTimeout(() => {
      this.showToast('Transaction saved successfully', 'success');
      this.closeModal();
      this.loadTransactions();
    }, 500);
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.toast = { message, type };
    setTimeout(() => {
      this.toast = null;
    }, 3000);
  }

  // Helper to get status color
  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  // Helper to get type color
  getTypeColor(type: string): string {
    return type === 'income' ? 'text-green-600' : 'text-red-600';
  }
}
