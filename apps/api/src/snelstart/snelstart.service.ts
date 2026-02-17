import { Injectable } from '@nestjs/common';
import { SnelStartClient } from './snelstart.client';

@Injectable()
export class SnelStartService {
  constructor(private client: SnelStartClient) {}

  // Delegate methods to client
  getProductGroups = () => this.client.getProductGroups();
  getProductGroupById = (id: string) => this.client.getProductGroupById(id);
  getProducts = (groupId?: string, search?: string) => this.client.getProducts(groupId, search);
  getProductsPaginated = (skip?: number, top?: number, modifiedSince?: Date) =>
    this.client.getProductsPaginated(skip, top, modifiedSince);
  getAllProductsPaginated = (modifiedSince?: Date, onProgress?: (current: number, total: number) => void) =>
    this.client.getAllProductsPaginated(modifiedSince, onProgress);
  getProductById = (id: string) => this.client.getProductById(id);
  getCustomers = (search?: string) => this.client.getCustomers(search);
  getCustomerById = (id: string) => this.client.getCustomerById(id);
  createCustomer = (customer: any) => this.client.createCustomer(customer);
  updateCustomer = (id: string, customer: any) => this.client.updateCustomer(id, customer);
  deleteCustomer = (id: string) => this.client.deleteCustomer(id);
  createSalesOrder = (order: any) => this.client.createSalesOrder(order);
  testConnection = (subscriptionKey: string, integrationKey: string) =>
    this.client.testConnection(subscriptionKey, integrationKey);
  getToken = (integrationKey: string) =>
    this.client.getToken(integrationKey);
  getCompanyInfo = () => this.client.getCompanyInfo();
  getArtikelOmzetGroepen = () => this.client.getArtikelOmzetGroepen();
  getSalesOrders = (customerId?: string) => this.client.getSalesOrders(customerId);
  getVerkoopordersPaginated = (skip?: number, top?: number, customerId?: string) =>
    this.client.getVerkoopordersPaginated(skip ?? 0, top ?? 500, customerId);
}

