"use client"
import { makeAutoObservable, runInAction } from "mobx";
import fetchWithAuth from '../../app/utils/fetchWithAuth';

class TagsStore {
  tags = [];
  loadingTags = false;
  errorTags = null;

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {
      rootStore: false
    });
  }

  async fetchTags() {
    const clientId = this.rootStore.clientId;
    if (!clientId) return;

    this.loadingTags = true;
    try {
      const res = await fetchWithAuth(`/api/tags?clientId=${clientId}`);
      const data = await res.json();
      runInAction(() => {
        this.tags = Array.isArray(data) ? data : [];
        this.loadingTags = false;
      });
    } catch (e) {
      runInAction(() => {
        this.tags = [];
        this.errorTags = e;
        this.loadingTags = false;
      });
    }
  }

  async addTag(tagData) {
    const clientId = this.rootStore.clientId;
    try {
      const response = await fetchWithAuth('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tagData, clientId })
      });

      if (response.ok) {
        const newTag = await response.json();
        runInAction(() => {
          this.tags.push(newTag);
        });
        return { success: true, data: newTag };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'Failed to add tag' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateTag(tagId, tagData) {
    try {
      const response = await fetchWithAuth(`/api/tags/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagData)
      });

      if (response.ok) {
        const updatedTag = await response.json();
        runInAction(() => {
          const index = this.tags.findIndex(t => t.id === tagId);
          if (index !== -1) {
            this.tags[index] = updatedTag;
          }
        });
        return { success: true, data: updatedTag };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'Failed to update tag' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteTag(tagId) {
    try {
      const response = await fetchWithAuth(`/api/tags/${tagId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        runInAction(() => {
          this.tags = this.tags.filter(t => t.id !== tagId);
        });
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.error || 'Failed to delete tag' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

export default TagsStore;
