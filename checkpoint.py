#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import shutil
import datetime
import tkinter as tk
from tkinter import filedialog, messagebox, ttk, simpledialog  # Added simpledialog
import threading
import json
import platform  # To handle os.startfile alternatives
import subprocess  # Needed for macOS/Linux open folder


class CheckpointApp:
    def __init__(self, root):
        self.root = root
        self.root.title("项目检查点工具 v2.1")  # Updated version
        self.root.geometry("750x650")
        self.root.resizable(True, True)

        # 设置默认项目路径
        self.project_path = os.path.abspath(os.path.dirname(__file__))

        # 设置默认备份路径
        self.backup_path = os.path.join(
            os.path.dirname(self.project_path), "Backups")

        # 设置默认排除的文件夹和文件
        self.default_excludes = [
            "node_modules",
            "dist",
            "out",
            ".git",
            "release",
            "__pycache__",
            "*.log",
            "*.lock",
            "*.exe",
            "*.dll",
            "*.zip",
            "*.tar.gz",
            "checkpoint_config.json",  # Exclude config file itself
            "checkpoint_info.txt"  # Exclude info file from being listed if somehow copied
        ]

        # 加载配置
        self.config_file = os.path.join(
            self.project_path, "checkpoint_config.json")
        self.load_config()

        # 创建UI
        self.create_ui()

        # 初始化时填充检查点列表
        self.populate_checkpoint_list()

    def load_config(self):
        """加载配置文件"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    saved_project_path = config.get('project_path')
                    if saved_project_path and os.path.isdir(saved_project_path):
                        self.project_path = saved_project_path
                    else:
                        print(
                            f"配置文件中的项目路径无效或不存在: {saved_project_path}, 使用默认值。")

                    saved_backup_path = config.get('backup_path')
                    if saved_backup_path:
                        self.backup_path = saved_backup_path
                    else:
                        print(f"配置文件中的备份路径无效: {saved_backup_path}, 使用默认值。")

                    # Ensure excludes is always a list, even if loaded config is bad
                    loaded_excludes = config.get('excludes')
                    if isinstance(loaded_excludes, list):
                        self.excludes = loaded_excludes
                    else:
                        print(f"配置文件中的排除项格式无效, 使用默认值。")
                        self.excludes = list(self.default_excludes)

            else:
                self.excludes = list(self.default_excludes)
                # Don't save immediately, let user do it or save on create
                # self.save_config()
        except json.JSONDecodeError as e:
            messagebox.showerror(
                "配置错误", f"加载配置文件时出错 (JSON 格式无效): {str(e)}\n将使用默认配置。")
            self.excludes = list(self.default_excludes)
        except Exception as e:
            messagebox.showerror("错误", f"加载配置文件失败: {str(e)}\n将使用默认配置。")
            self.excludes = list(self.default_excludes)

    def save_config(self):
        """保存配置文件"""
        try:
            # Ensure paths are updated from UI vars before saving
            self.project_path = self.project_path_var.get() if hasattr(
                self, 'project_path_var') else self.project_path
            self.backup_path = self.backup_path_var.get() if hasattr(
                self, 'backup_path_var') else self.backup_path
            self.excludes = list(self.exclude_listbox.get(0, tk.END)) if hasattr(
                self, 'exclude_listbox') else self.excludes

            config = {
                'project_path': self.project_path,
                'backup_path': self.backup_path,
                'excludes': self.excludes
            }
            # Ensure the config file itself is saved in the project path
            config_path_to_save = os.path.join(
                self.project_path, "checkpoint_config.json")
            with open(config_path_to_save, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=4)
            self.config_file = config_path_to_save  # Update the path used by the app
            # Optionally provide feedback
            # self.status_var.set("配置已保存")
        except Exception as e:
            messagebox.showerror("错误", f"保存配置文件失败: {str(e)}")
            # self.status_var.set("保存配置失败")

    def create_ui(self):
        """创建用户界面"""
        # --- Main Frame ---
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        # Allow column 1 (entries/lists) to expand
        main_frame.columnconfigure(1, weight=1)

        # --- Row 0: Project Path ---
        ttk.Label(main_frame, text="项目路径:").grid(
            column=0, row=0, sticky=tk.W, pady=5, padx=5)
        self.project_path_var = tk.StringVar(value=self.project_path)
        ttk.Entry(main_frame, textvariable=self.project_path_var, width=60).grid(
            column=1, row=0, sticky=(tk.W, tk.E), pady=5)
        ttk.Button(main_frame, text="浏览...", command=self.browse_project_path).grid(
            column=2, row=0, sticky=tk.W, padx=5, pady=5)

        # --- Row 1: Backup Path ---
        ttk.Label(main_frame, text="备份路径:").grid(
            column=0, row=1, sticky=tk.W, pady=5, padx=5)
        self.backup_path_var = tk.StringVar(value=self.backup_path)
        ttk.Entry(main_frame, textvariable=self.backup_path_var, width=60).grid(
            column=1, row=1, sticky=(tk.W, tk.E), pady=5)
        ttk.Button(main_frame, text="浏览...", command=self.browse_backup_path).grid(
            column=2, row=1, sticky=tk.W, padx=5, pady=5)

        # --- Row 2: Checkpoint Name ---
        ttk.Label(main_frame, text="检查点名称:").grid(
            column=0, row=2, sticky=tk.W, pady=5, padx=5)
        self.checkpoint_name_var = tk.StringVar(
            value=f"checkpoint_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}")
        ttk.Entry(main_frame, textvariable=self.checkpoint_name_var, width=60).grid(
            column=1, row=2, sticky=(tk.W, tk.E), pady=5)

        # --- Row 3: Excludes ---
        ttk.Label(main_frame, text="排除项:").grid(column=0, row=3,
                                                sticky=tk.NW, pady=5, padx=5)  # Use NW for alignment

        exclude_frame = ttk.Frame(main_frame)
        exclude_frame.grid(column=1, row=3, sticky=(
            tk.W, tk.E, tk.N, tk.S), pady=5)
        exclude_frame.columnconfigure(0, weight=1)
        exclude_frame.rowconfigure(0, weight=1)

        self.exclude_listbox = tk.Listbox(
            exclude_frame, width=50, height=6)  # Reduced height a bit
        self.exclude_listbox.grid(
            column=0, row=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        scrollbar = ttk.Scrollbar(
            exclude_frame, orient=tk.VERTICAL, command=self.exclude_listbox.yview)
        scrollbar.grid(column=1, row=0, sticky=(tk.N, tk.S))
        self.exclude_listbox.config(yscrollcommand=scrollbar.set)

        if isinstance(self.excludes, list):  # Ensure self.excludes is iterable
            for item in self.excludes:
                self.exclude_listbox.insert(tk.END, item)
        else:
            print("Error: self.excludes is not a list during UI creation.")
            self.excludes = list(self.default_excludes)  # Reset to default

        exclude_btn_frame = ttk.Frame(main_frame)
        exclude_btn_frame.grid(
            column=2, row=3, sticky=tk.NW, padx=5, pady=5)  # Use NW

        ttk.Button(exclude_btn_frame, text="添加",
                   command=self.add_exclude).pack(fill=tk.X, pady=2)
        ttk.Button(exclude_btn_frame, text="删除选中",  # Clarify text
                   command=self.remove_exclude).pack(fill=tk.X, pady=2)
        ttk.Button(exclude_btn_frame, text="重置默认",  # Clarify text
                   command=self.reset_excludes).pack(fill=tk.X, pady=2)

        # --- Row 4: Separator ---
        ttk.Separator(main_frame, orient=tk.HORIZONTAL).grid(
            column=0, row=4, columnspan=3, sticky=(tk.W, tk.E), pady=10)

        # --- Row 5: Checkpoint List ---
        ttk.Label(main_frame, text="可用检查点:").grid(
            column=0, row=5, sticky=tk.NW, pady=5, padx=5)

        checkpoint_list_frame = ttk.Frame(main_frame)
        checkpoint_list_frame.grid(
            column=1, row=5, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        checkpoint_list_frame.columnconfigure(0, weight=1)
        checkpoint_list_frame.rowconfigure(0, weight=1)
        # Allow this row containing the list to expand vertically
        main_frame.rowconfigure(5, weight=1)

        cols = ("Name", "Date Created")
        self.checkpoint_tree = ttk.Treeview(
            checkpoint_list_frame, columns=cols, show='headings', height=8)
        self.checkpoint_tree.grid(
            column=0, row=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        self.checkpoint_tree.heading("Name", text="检查点名称")
        self.checkpoint_tree.heading("Date Created", text="创建日期")
        self.checkpoint_tree.column("Name", width=250, anchor=tk.W)
        self.checkpoint_tree.column(
            "Date Created", width=150, anchor=tk.CENTER)

        tree_scrollbar = ttk.Scrollbar(
            checkpoint_list_frame, orient=tk.VERTICAL, command=self.checkpoint_tree.yview)
        tree_scrollbar.grid(column=1, row=0, sticky=(tk.N, tk.S))
        self.checkpoint_tree.config(yscrollcommand=tree_scrollbar.set)

        self.checkpoint_tree.bind(
            '<<TreeviewSelect>>', self.on_checkpoint_select)

        checkpoint_list_btn_frame = ttk.Frame(main_frame)
        checkpoint_list_btn_frame.grid(
            column=2, row=5, sticky=tk.NW, padx=5, pady=5)

        ttk.Button(checkpoint_list_btn_frame, text="刷新列表",
                   command=self.populate_checkpoint_list).pack(fill=tk.X, pady=2)
        self.restore_button = ttk.Button(
            checkpoint_list_btn_frame, text="恢复检查点", command=self.restore_checkpoint, state=tk.DISABLED)
        self.restore_button.pack(fill=tk.X, pady=2)

        # --- NEW: Delete Button ---
        self.delete_button = ttk.Button(
            checkpoint_list_btn_frame, text="删除检查点", command=self.delete_checkpoint, state=tk.DISABLED)
        self.delete_button.pack(fill=tk.X, pady=2)
        # --- End New Button ---

        # --- Row 6: Progress Bar ---
        ttk.Label(main_frame, text="进度:").grid(
            column=0, row=6, sticky=tk.W, pady=5, padx=5)
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(
            main_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.grid(column=1, row=6, columnspan=2, sticky=(
            tk.W, tk.E), pady=5, padx=(0, 5))

        # --- Row 7: Status Label ---
        self.status_var = tk.StringVar(value="就绪")
        ttk.Label(main_frame, textvariable=self.status_var).grid(
            column=1, row=7, columnspan=2, sticky=tk.W, pady=5)

        # --- Row 8: Action Buttons ---
        btn_frame = ttk.Frame(main_frame)
        btn_frame.grid(column=0, row=8, columnspan=3, sticky=tk.E, pady=10)

        ttk.Button(btn_frame, text="创建检查点", command=self.create_checkpoint).pack(
            side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="打开备份文件夹", command=self.open_backup_folder).pack(
            side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="保存配置", command=self.save_config).pack(
            side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="退出", command=self.root.quit).pack(
            side=tk.LEFT, padx=5)

    def browse_project_path(self):
        """浏览项目路径"""
        initial_dir = self.project_path_var.get()
        if not os.path.isdir(initial_dir):
            initial_dir = os.path.dirname(self.project_path)

        path = filedialog.askdirectory(initialdir=initial_dir, title="选择项目路径")
        if path:
            self.project_path = os.path.abspath(path)
            self.project_path_var.set(self.project_path)
            # No auto-save, no config file path change needed here

    def browse_backup_path(self):
        """浏览备份路径"""
        initial_dir = self.backup_path_var.get()
        if not os.path.isdir(initial_dir):
            parent_dir = os.path.dirname(initial_dir)
            if os.path.isdir(parent_dir):
                initial_dir = parent_dir
            else:
                initial_dir = os.path.dirname(self.project_path)

        path = filedialog.askdirectory(initialdir=initial_dir, title="选择备份路径")
        if path:
            self.backup_path = os.path.abspath(path)
            self.backup_path_var.set(self.backup_path)
            self.populate_checkpoint_list()  # Refresh list after changing backup path

    def add_exclude(self):
        """添加排除项"""
        new_exclude = simpledialog.askstring(
            "添加排除项", "输入要排除的文件夹/文件模式:", parent=self.root)
        if new_exclude and new_exclude.strip():
            item = new_exclude.strip()
            if item not in self.exclude_listbox.get(0, tk.END):
                self.exclude_listbox.insert(tk.END, item)
                self.excludes = list(self.exclude_listbox.get(0, tk.END))
                # self.save_config() # Manual save

    def remove_exclude(self):
        """删除排除项"""
        selected_indices = self.exclude_listbox.curselection()
        if selected_indices:
            for i in reversed(selected_indices):
                self.exclude_listbox.delete(i)
            self.excludes = list(self.exclude_listbox.get(0, tk.END))
            # self.save_config() # Manual save
        else:
            messagebox.showwarning("无选择", "请在排除项列表中选择要删除的项目。")

    def reset_excludes(self):
        """重置排除项为默认值"""
        if messagebox.askyesno("确认", "确定要将排除项重置为默认列表吗?\n当前列表中的所有项都将被替换。", parent=self.root):
            self.exclude_listbox.delete(0, tk.END)
            self.excludes = list(self.default_excludes)  # Make a copy
            for item in self.excludes:
                self.exclude_listbox.insert(tk.END, item)
            # self.save_config() # Manual save

    def start_file_explorer(self, path):
        """Opens the folder in the default file explorer."""
        try:
            abs_path = os.path.abspath(path)  # Ensure path is absolute
            if not os.path.exists(abs_path):
                messagebox.showerror("错误", f"路径不存在: {abs_path}")
                return
            if not os.path.isdir(abs_path):
                messagebox.showerror("错误", f"路径不是一个文件夹: {abs_path}")
                return

            if platform.system() == "Windows":
                os.startfile(abs_path)
            elif platform.system() == "Darwin":  # macOS
                subprocess.Popen(["open", abs_path])
            else:  # Linux and other Unix-like
                subprocess.Popen(["xdg-open", abs_path])
        except FileNotFoundError:
            # This might happen if xdg-open or open isn't found
            messagebox.showerror("错误", f"无法找到文件浏览器命令来打开路径: {path}")
        except Exception as e:
            messagebox.showerror("错误", f"无法打开文件夹: {str(e)}")

    def open_backup_folder(self):
        """打开备份文件夹"""
        current_backup_path = self.backup_path_var.get()
        if os.path.exists(current_backup_path) and os.path.isdir(current_backup_path):
            self.start_file_explorer(current_backup_path)
        else:
            if messagebox.askyesno("提示", f"备份文件夹 '{current_backup_path}' 不存在。\n是否立即创建?", parent=self.root):
                try:
                    os.makedirs(current_backup_path, exist_ok=True)
                    self.start_file_explorer(current_backup_path)
                except Exception as e:
                    messagebox.showerror("错误", f"无法创建备份文件夹: {str(e)}")

    def should_exclude(self, path, base_path):
        """检查路径是否应该被排除 (更精确的检查)"""
        try:
            abs_path = os.path.abspath(path)
            abs_base_path = os.path.abspath(base_path)
            if not abs_path.startswith(abs_base_path + os.sep) and abs_path != abs_base_path:
                # If path isn't within base_path, check only basename or extension
                filename = os.path.basename(abs_path)
                for exclude_pattern in self.excludes:
                    exclude_pattern = exclude_pattern.strip()
                    if not exclude_pattern:
                        continue
                    if exclude_pattern.startswith("*."):
                        if filename.endswith(exclude_pattern[1:]):
                            return True
                    elif filename == exclude_pattern:
                        # Check if it's a directory name match as well
                        if os.path.isdir(abs_path) and filename == exclude_pattern:
                            return True
                        # Check if it's a filename match
                        if os.path.isfile(abs_path) and filename == exclude_pattern:
                            return True
                return False  # Not in base, and no direct match

            rel_path = os.path.relpath(abs_path, abs_base_path)
        except ValueError:
            # Handle cases where paths are on different drives on Windows
            rel_path = os.path.basename(path)

        # Normalize path separators for consistent matching
        rel_path_normalized = rel_path.replace(os.sep, '/')
        path_parts = rel_path_normalized.split('/')
        filename = os.path.basename(path)  # Use original path for basename

        current_excludes = list(self.exclude_listbox.get(0, tk.END)) if hasattr(
            self, 'exclude_listbox') else self.excludes

        for exclude_pattern in current_excludes:
            exclude_pattern = exclude_pattern.strip().replace(
                os.sep, '/')  # Normalize pattern
            if not exclude_pattern:
                continue

            # 1. Wildcard extension match (e.g., *.log)
            if exclude_pattern.startswith("*."):
                # Case-insensitive extension match
                if filename.lower().endswith(exclude_pattern[1:].lower()):
                    # print(f"Excluding '{rel_path}' due to wildcard '{exclude_pattern}'")
                    return True
            # 2. Exact match for file or directory name anywhere in the path
            #    Avoid matching parts of names, e.g. 'node' should not exclude 'node_helper'
            elif exclude_pattern in path_parts:
                # Check if it's a full component match
                idx = path_parts.index(exclude_pattern)
                # If it's a directory match (not the last part, or it is the last part and the path IS a dir)
                is_dir_match = (idx < len(path_parts) - 1 or (idx ==
                                len(path_parts) - 1 and os.path.isdir(path)))
                # If it's a file match (last part and the path IS a file)
                is_file_match = (idx == len(
                    path_parts) - 1 and os.path.isfile(path) and filename == exclude_pattern)

                if is_dir_match or is_file_match:
                    # print(f"Excluding '{rel_path}' because component '{exclude_pattern}' is in excludes")
                    return True

            # 3. Exact match for relative path start (e.g., build/ or specific_file.txt)
            #    Ensure it matches a full directory or the exact file name.
            elif rel_path_normalized.startswith(exclude_pattern):
                # Check if it's an exact match or matches a directory boundary
                if (rel_path_normalized == exclude_pattern or
                        rel_path_normalized.startswith(exclude_pattern + '/')):
                    # print(f"Excluding '{rel_path}' due to start match '{exclude_pattern}'")
                    return True

        return False

    # --- Checkpoint Creation ---

    def create_checkpoint(self):
        """创建检查点（在单独的线程中运行）"""
        self.status_var.set("准备创建...")
        self.progress_var.set(0)

        # Get LATEST paths, name, and excludes from UI elements
        self.project_path = self.project_path_var.get()
        self.backup_path = self.backup_path_var.get()
        checkpoint_name = self.checkpoint_name_var.get().strip()
        self.excludes = list(self.exclude_listbox.get(0, tk.END))

        if not checkpoint_name:
            messagebox.showerror("错误", "检查点名称不能为空。")
            self.status_var.set("已取消")
            return
        invalid_chars = '<>:"/\\|?*'
        if any(char in checkpoint_name for char in invalid_chars):
            messagebox.showerror("错误", f"检查点名称包含无效字符 ({invalid_chars})。")
            self.status_var.set("已取消")
            return

        if not os.path.exists(self.project_path) or not os.path.isdir(self.project_path):
            messagebox.showerror(
                "错误", f"项目路径不存在或不是有效文件夹:\n{self.project_path}")
            self.status_var.set("就绪")
            return

        if not os.path.exists(self.backup_path):
            if messagebox.askyesno("确认", f"备份根目录不存在:\n{self.backup_path}\n\n是否现在创建它?", parent=self.root):
                try:
                    os.makedirs(self.backup_path, exist_ok=True)
                except Exception as e:
                    messagebox.showerror("错误", f"无法创建备份根目录: {str(e)}")
                    self.status_var.set("就绪")
                    return
            else:
                self.status_var.set("已取消")
                return
        elif not os.path.isdir(self.backup_path):
            messagebox.showerror("错误", f"指定的备份路径不是有效文件夹:\n{self.backup_path}")
            self.status_var.set("就绪")
            return

        # Save configuration BEFORE starting the thread
        self.save_config()

        thread = threading.Thread(
            target=self._create_checkpoint_thread, args=(checkpoint_name,))
        thread.daemon = True
        thread.start()

    def _create_checkpoint_thread(self, checkpoint_name):
        """在线程中执行检查点创建"""
        try:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            # Sanitize checkpoint name slightly for folder name (replace spaces, etc.)
            safe_folder_name_part = "".join(c if c.isalnum() or c in [
                                            '-', '_'] else '_' for c in checkpoint_name)
            if not safe_folder_name_part:
                safe_folder_name_part = "checkpoint"  # fallback

            base_backup_folder_name = f"{safe_folder_name_part}_{timestamp}"
            backup_folder = os.path.join(
                self.backup_path, base_backup_folder_name)

            counter = 1
            original_backup_folder = backup_folder
            while os.path.exists(backup_folder):
                backup_folder = f"{original_backup_folder}_{counter}"
                counter += 1
                if counter > 100:
                    raise Exception("无法创建唯一的备份文件夹名称，请检查备份目录。")

            self.root.after(0, lambda: self.status_var.set("正在扫描项目文件..."))

            files_to_copy = []
            folders_to_create = set()

            for root, dirs, files in os.walk(self.project_path, topdown=True, onerror=lambda e: print(f"Warning: Cannot access {e.filename} - {e.strerror}")):
                # Store original dirs before filtering for exclusion check
                original_dirs = list(dirs)
                # Filter directories based on exclusion rules
                dirs[:] = [d for d in dirs if not self.should_exclude(
                    os.path.join(root, d), self.project_path)]

                current_rel_root = os.path.relpath(root, self.project_path)

                # Add directories that are *not* excluded to the creation list
                # Needed if a directory is empty but should still be backed up
                if current_rel_root != '.':
                    if not self.should_exclude(root, self.project_path):
                        folders_to_create.add(current_rel_root)

                for file in files:
                    src_path = os.path.join(root, file)
                    if not self.should_exclude(src_path, self.project_path):
                        files_to_copy.append(src_path)
                        file_rel_dir = os.path.dirname(
                            os.path.relpath(src_path, self.project_path))
                        if file_rel_dir and file_rel_dir != '.':
                            # Check if the parent dir itself should be excluded
                            parent_dir_path = os.path.join(
                                self.project_path, file_rel_dir)
                            if not self.should_exclude(parent_dir_path, self.project_path):
                                folders_to_create.add(file_rel_dir)

            total_files = len(files_to_copy)
            if total_files == 0 and not folders_to_create:
                self.root.after(0, lambda: messagebox.showwarning(
                    "警告", "没有找到要备份的文件或文件夹（可能都被排除了）。"))
                self.root.after(0, self._checkpoint_failed, "没有文件可备份")
                return

            self.root.after(0, lambda: self.status_var.set(
                f"准备复制 {total_files} 个文件和创建文件夹..."))

            os.makedirs(backup_folder, exist_ok=True)

            # Normalize paths in folders_to_create before joining
            normalized_folders = {f.replace(os.sep, '/')
                                  for f in folders_to_create}

            for folder_rel_path in sorted(list(normalized_folders)):
                # Reconstruct platform-specific path for creation
                dst_folder_path_parts = folder_rel_path.split('/')
                dst_folder_path = os.path.join(
                    backup_folder, *dst_folder_path_parts)
                try:
                    os.makedirs(dst_folder_path, exist_ok=True)
                except OSError as e:
                    print(
                        f"Warning: Could not create directory {dst_folder_path}: {e}")
                    # Decide if this is critical - maybe continue copying files?

            copied_count = 0
            for i, src_path in enumerate(files_to_copy):
                try:
                    rel_path = os.path.relpath(src_path, self.project_path)
                    # Normalize relative path before joining
                    normalized_rel_path = rel_path.replace(os.sep, '/')
                    dst_path_parts = normalized_rel_path.split('/')
                    dst_path = os.path.join(backup_folder, *dst_path_parts)

                    # Ensure destination directory exists (redundant check, but safe)
                    dst_dir = os.path.dirname(dst_path)
                    if not os.path.exists(dst_dir):
                        # This shouldn't happen if folder creation worked, but handle anyway
                        try:
                            os.makedirs(dst_dir, exist_ok=True)
                            # print(f"Created missing destination directory: {dst_dir}")
                        except Exception as mkdir_err:
                            print(
                                f"ERROR: Failed to create missing directory {dst_dir} for {dst_path}: {mkdir_err}")
                            # Skip this file or raise error? For now, print and continue.
                            continue  # Skip this file

                    shutil.copy2(src_path, dst_path)
                    copied_count += 1

                    if (i + 1) % 10 == 0 or (i + 1) == total_files:  # Update less frequently
                        progress = (i + 1) / total_files * \
                            100 if total_files > 0 else 100
                        status_msg = f"正在复制: {os.path.basename(src_path)} ({i+1}/{total_files})"
                        self.root.after(0, lambda p=progress,
                                        s=status_msg: self._update_progress(p, s))
                except Exception as copy_err:
                    print(
                        f"ERROR: Failed to copy {src_path} to {dst_path}: {copy_err}")
                    # Optionally update status or log this error more formally
                    # Continue with the next file

            # --- Create Checkpoint Info File ---
            info_file = os.path.join(backup_folder, "checkpoint_info.txt")
            creation_time = datetime.datetime.now()
            # Get current excludes list *as used for this backup*
            excludes_used = list(self.exclude_listbox.get(0, tk.END)) if hasattr(
                self, 'exclude_listbox') else self.excludes

            with open(info_file, 'w', encoding='utf-8') as f:
                # User-provided name
                f.write(f"Checkpoint Name: {checkpoint_name}\n")
                f.write(f"Original Project Path: {self.project_path}\n")
                f.write(
                    f"Creation Time: {creation_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(
                    f"Timestamped Folder: {os.path.basename(backup_folder)}\n")
                # Use actual copied count
                f.write(f"Files Copied: {copied_count}\n")
                f.write(
                    f"Folders Created (in backup): {len(folders_to_create)}\n")
                f.write(f"Exclusions Used ({len(excludes_used)}):\n")
                for excl in sorted(excludes_used):  # Sort for consistency
                    f.write(f"- {excl}\n")

            # --- Completion ---
            self.root.after(
                0, lambda bf=backup_folder, cc=copied_count: self._checkpoint_completed(bf, cc))

        except Exception as e:
            # Attempt to clean up partially created folder on error
            if 'backup_folder' in locals() and os.path.exists(backup_folder):
                try:
                    shutil.rmtree(backup_folder)
                    print(
                        f"Cleaned up incomplete backup folder: {backup_folder}")
                except Exception as cleanup_e:
                    print(
                        f"Error cleaning up failed backup folder {backup_folder}: {cleanup_e}")
            self.root.after(0, self._checkpoint_failed, str(e))

    def _update_progress(self, progress, status):
        """更新进度条和状态（从线程中调用）"""
        self.progress_var.set(progress)
        self.status_var.set(status)

    def _checkpoint_completed(self, backup_folder, copied_count):
        """检查点创建完成（从线程中调用）"""
        self.progress_var.set(100)
        self.status_var.set(f"检查点创建完成 ({copied_count} 文件)")

        self.populate_checkpoint_list()

        next_name = f"checkpoint_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.checkpoint_name_var.set(next_name)

        result = messagebox.askquestion("成功",
                                        f"检查点已成功创建:\n{os.path.basename(backup_folder)}\n({copied_count} 个文件已复制)\n\n是否打开包含此备份的文件夹?",
                                        parent=self.root)
        if result == 'yes':
            # Open the main backup folder
            self.start_file_explorer(self.backup_path_var.get())

    def _checkpoint_failed(self, error_msg):
        """检查点创建失败（从线程中调用）"""
        self.progress_var.set(0)
        # Show truncated error
        self.status_var.set(f"创建失败: {error_msg[:100]}...")
        messagebox.showerror("错误", f"创建检查点失败: \n{error_msg}", parent=self.root)

    # --- Checkpoint Listing & Restoration & Deletion ---

    def populate_checkpoint_list(self):
        """填充可用检查点列表"""
        # Clear existing items
        for item in self.checkpoint_tree.get_children():
            self.checkpoint_tree.delete(item)

        current_backup_path = self.backup_path_var.get()
        if not os.path.isdir(current_backup_path):
            self.status_var.set("备份路径无效，无法列出检查点")
            self.on_checkpoint_select()  # Ensure buttons are disabled
            return

        checkpoints = []
        try:
            for item_name in os.listdir(current_backup_path):
                item_path = os.path.join(current_backup_path, item_name)
                info_file_path = os.path.join(item_path, "checkpoint_info.txt")

                # Basic check: is it a directory AND does it contain the info file?
                if os.path.isdir(item_path) and os.path.exists(info_file_path):
                    try:
                        # Try reading the info file for better name/date
                        name = item_name  # Default to folder name
                        date_str = "N/A"  # Default date
                        # Attempt to get modification time as a fallback date
                        try:
                            mtime = os.path.getmtime(item_path)
                            date_str = datetime.datetime.fromtimestamp(
                                mtime).strftime('%Y-%m-%d %H:%M:%S')
                        except Exception:
                            pass  # Ignore errors getting mtime

                        with open(info_file_path, 'r', encoding='utf-8') as f:
                            for line in f:
                                if line.startswith("Checkpoint Name:"):
                                    # Use strip() to remove potential leading/trailing whitespace
                                    name = line.split(":", 1)[1].strip()
                                elif line.startswith("Creation Time:"):
                                    date_str = line.split(":", 1)[1].strip()
                                    # Optional: Validate date format here if needed
                        checkpoints.append(
                            {"id": item_path, "name": name, "date": date_str, "folder": item_name})
                    except Exception as e:
                        print(f"无法读取检查点信息 {item_name}: {e}")
                        # Add with basic info even if info file is corrupt/unreadable
                        checkpoints.append(
                            {"id": item_path, "name": f"{item_name} (信息读取错误)", "date": date_str, "folder": item_name})
                # else: # Optional: Log items that look like checkpoints but aren't (e.g., missing info file)
                #    if os.path.isdir(item_path) and "checkpoint" in item_name.lower():
                #         print(f"Skipping potential checkpoint folder without info file: {item_name}")

        except Exception as e:
            messagebox.showerror("列表错误", f"扫描备份文件夹时出错: {e}")
            self.on_checkpoint_select()  # Ensure buttons are disabled
            return

        # Sort checkpoints, newest first based on folder name (timestamp)
        # Robust sorting: try to extract timestamp, otherwise use folder name
        def get_sort_key(cp):
            parts = cp.get("folder", "").split('_')
            if len(parts) >= 2:
                # Try combining date and time parts if they look like YYYYMMDD_HHMMSS
                potential_timestamp = "_".join(parts[-2:])
                if len(potential_timestamp) == 15 and potential_timestamp[8] == '_':
                    return potential_timestamp
            return cp.get("folder", "")  # Fallback to full folder name

        checkpoints.sort(key=get_sort_key, reverse=True)

        # Populate Treeview
        for cp in checkpoints:
            self.checkpoint_tree.insert(
                "", tk.END, iid=cp["id"], values=(cp["name"], cp["date"]))

        # Update status and button states
        if not checkpoints:
            self.status_var.set("未找到检查点")
        else:
            self.status_var.set(f"找到 {len(checkpoints)} 个检查点")

        # Update button states based on selection (likely none now)
        self.on_checkpoint_select()

    def on_checkpoint_select(self, event=None):
        """当 Treeview 中的选择发生变化时调用"""
        selected_items = self.checkpoint_tree.selection()
        if selected_items:
            self.restore_button.config(state=tk.NORMAL)
            self.delete_button.config(state=tk.NORMAL)  # Enable delete button
        else:
            self.restore_button.config(state=tk.DISABLED)
            # Disable delete button
            self.delete_button.config(state=tk.DISABLED)

    def restore_checkpoint(self):
        """启动恢复选定检查点的过程"""
        selected_items = self.checkpoint_tree.selection()
        if not selected_items:
            messagebox.showwarning("无选择", "请先在列表中选择一个检查点进行恢复。")
            return

        selected_item_id = selected_items[0]
        checkpoint_path_to_restore = selected_item_id
        checkpoint_display_name = self.checkpoint_tree.item(
            selected_item_id, "values")[0]

        self.project_path = self.project_path_var.get()
        if not os.path.isdir(self.project_path):
            messagebox.showerror(
                "错误", f"项目路径无效或不存在，无法恢复:\n{self.project_path}")
            return

        confirm = messagebox.askyesno("确认恢复",
                                      f"确定要从检查点恢复项目吗？\n\n"
                                      f"检查点: {checkpoint_display_name}\n"
                                      f"源路径: {checkpoint_path_to_restore}\n"
                                      f"目标项目路径: {self.project_path}\n\n"
                                      f"警告：这将用备份中的文件覆盖项目路径中的现有文件。\n"
                                      f"（注意：项目路径中多余的文件不会被删除）\n\n"
                                      f"此操作无法撤销！",
                                      icon='warning', parent=self.root)

        if not confirm:
            self.status_var.set("恢复已取消")
            return

        self.status_var.set("准备恢复...")
        self.progress_var.set(0)
        # Disable buttons during operation
        self.restore_button.config(state=tk.DISABLED)
        self.delete_button.config(state=tk.DISABLED)
        self.root.update_idletasks()

        thread = threading.Thread(target=self._restore_checkpoint_thread,
                                  args=(checkpoint_path_to_restore, self.project_path))
        thread.daemon = True
        thread.start()

    def _restore_checkpoint_thread(self, checkpoint_src_path, project_target_path):
        """在线程中执行恢复操作"""
        try:
            self.root.after(0, lambda: self.status_var.set("正在扫描备份文件..."))

            files_to_copy = []
            folders_to_create = set()  # Folders needed in the target project path

            # Walk the *backup* directory
            for root, dirs, files in os.walk(checkpoint_src_path, topdown=True, onerror=lambda e: print(f"Warning: Cannot access {e.filename} - {e.strerror}")):
                # Don't restore the info file itself
                if "checkpoint_info.txt" in files:
                    files.remove("checkpoint_info.txt")

                current_rel_root = os.path.relpath(root, checkpoint_src_path)
                if current_rel_root != '.':
                    # Need to create this dir in the target
                    folders_to_create.add(current_rel_root)

                for file in files:
                    src_file_path = os.path.join(root, file)
                    files_to_copy.append(src_file_path)
                    # Ensure the file's target directory is marked for creation
                    file_rel_dir = os.path.dirname(
                        os.path.relpath(src_file_path, checkpoint_src_path))
                    if file_rel_dir and file_rel_dir != '.':
                        folders_to_create.add(file_rel_dir)

            total_files = len(files_to_copy)
            if total_files == 0 and not folders_to_create:
                self.root.after(0, lambda: messagebox.showwarning(
                    "恢复警告", "选定的检查点似乎是空的（没有文件或文件夹需要恢复）。"))
                self.root.after(0, self._restore_failed, "检查点为空")
                return

            self.root.after(0, lambda: self.status_var.set(
                f"找到 {total_files} 个文件和 {len(folders_to_create)} 个文件夹准备恢复..."))

            # Normalize folder paths before creating
            normalized_folders = {f.replace(os.sep, '/')
                                  for f in folders_to_create}

            # Create directories first
            for folder_rel_path in sorted(list(normalized_folders)):
                dst_folder_path_parts = folder_rel_path.split('/')
                dst_folder_path = os.path.join(
                    project_target_path, *dst_folder_path_parts)
                try:
                    if os.path.exists(dst_folder_path) and not os.path.isdir(dst_folder_path):
                        # Critical conflict: a file exists where a directory needs to be
                        raise Exception(
                            f"无法创建目录，因为同名文件已存在于目标路径: {dst_folder_path}")
                    os.makedirs(dst_folder_path, exist_ok=True)
                except OSError as e:
                    print(
                        f"Warning: Could not create target directory {dst_folder_path}: {e}")
                    # Decide if this is critical - maybe continue copying files?

            # Copy files
            restored_count = 0
            for i, backup_src_path in enumerate(files_to_copy):
                try:
                    rel_path = os.path.relpath(
                        backup_src_path, checkpoint_src_path)
                    # Normalize relative path before joining
                    normalized_rel_path = rel_path.replace(os.sep, '/')
                    dst_path_parts = normalized_rel_path.split('/')
                    project_dst_path = os.path.join(
                        project_target_path, *dst_path_parts)

                    # Ensure target directory exists before copying
                    project_dst_dir = os.path.dirname(project_dst_path)
                    if not os.path.isdir(project_dst_dir):
                        # This might happen if folder creation failed or structure is unexpected
                        try:
                            os.makedirs(project_dst_dir, exist_ok=True)
                            # print(f"Created missing target directory during file copy: {project_dst_dir}")
                        except Exception as mkdir_err:
                            print(
                                f"ERROR: Failed to create target directory {project_dst_dir} for {project_dst_path}: {mkdir_err}")
                            # Skip this file or raise error?
                            continue  # Skip this file

                    # Overwrites existing files
                    shutil.copy2(backup_src_path, project_dst_path)
                    restored_count += 1

                    if (i + 1) % 20 == 0 or (i + 1) == total_files:
                        progress = (i + 1) / total_files * \
                            100 if total_files > 0 else 100
                        status_msg = f"正在恢复: {os.path.basename(project_dst_path)} ({i+1}/{total_files})"
                        self.root.after(0, lambda p=progress,
                                        s=status_msg: self._update_progress(p, s))
                except Exception as copy_err:
                    print(
                        f"ERROR: Failed to restore {backup_src_path} to {project_dst_path}: {copy_err}")
                    # Continue with the next file

            # --- Completion ---
            self.root.after(0, self._restore_completed, restored_count)

        except Exception as e:
            self.root.after(0, self._restore_failed, str(e))

    def _restore_completed(self, restored_count):
        """恢复完成时调用"""
        self.progress_var.set(100)
        self.status_var.set(f"恢复操作完成 ({restored_count} 文件)")
        messagebox.showinfo(
            "成功", f"项目已成功从所选检查点恢复。\n({restored_count} 个文件已复制/覆盖)", parent=self.root)
        self.on_checkpoint_select()  # Re-enable buttons if selection still valid

    def _restore_failed(self, error_msg):
        """恢复失败时调用"""
        self.progress_var.set(0)
        self.status_var.set(f"恢复失败: {error_msg[:100]}...")
        messagebox.showerror(
            "恢复错误", f"恢复检查点时发生错误: \n{error_msg}", parent=self.root)
        self.on_checkpoint_select()  # Re-enable buttons if selection still valid

    # --- NEW: Delete Checkpoint Methods ---
    def delete_checkpoint(self):
        """启动删除选定检查点的过程"""
        selected_items = self.checkpoint_tree.selection()
        if not selected_items:
            messagebox.showwarning("无选择", "请先在列表中选择一个检查点进行删除。")
            return

        selected_item_id = selected_items[0]  # iid is the full path
        checkpoint_path_to_delete = selected_item_id
        checkpoint_display_name = self.checkpoint_tree.item(
            selected_item_id, "values")[0]
        checkpoint_folder_name = os.path.basename(checkpoint_path_to_delete)

        # --- CRITICAL CONFIRMATION ---
        confirm = messagebox.askyesno("确认删除",
                                      f"确定要永久删除这个检查点吗？\n\n"
                                      f"检查点名称: {checkpoint_display_name}\n"
                                      f"文件夹: {checkpoint_folder_name}\n"
                                      f"完整路径: {checkpoint_path_to_delete}\n\n"
                                      f"警告：这将永久删除备份文件夹及其所有内容。\n"
                                      f"此操作无法撤销！",
                                      icon='warning', parent=self.root)

        if not confirm:
            self.status_var.set("删除已取消")
            return

        self.status_var.set(f"准备删除 '{checkpoint_folder_name}'...")
        # Reset progress, though deletion might be quick
        self.progress_var.set(0)
        # Disable buttons during operation
        self.restore_button.config(state=tk.DISABLED)
        self.delete_button.config(state=tk.DISABLED)
        self.root.update_idletasks()

        # Start deletion in a separate thread
        thread = threading.Thread(target=self._delete_checkpoint_thread,
                                  args=(checkpoint_path_to_delete, checkpoint_folder_name))
        thread.daemon = True
        thread.start()

    def _delete_checkpoint_thread(self, checkpoint_path, folder_name):
        """在线程中执行删除操作"""
        try:
            self.root.after(0, lambda: self.status_var.set(
                f"正在删除 {folder_name}..."))
            # Add a small delay for UI update if needed, though usually not necessary for deletion
            # time.sleep(0.1)

            if not os.path.exists(checkpoint_path) or not os.path.isdir(checkpoint_path):
                # Check if it already disappeared somehow
                raise FileNotFoundError(f"检查点文件夹似乎已不存在: {checkpoint_path}")

            shutil.rmtree(checkpoint_path)

            # Verify deletion
            if os.path.exists(checkpoint_path):
                # This shouldn't happen if rmtree succeeded without error
                raise OSError(f"尝试删除后文件夹仍然存在: {checkpoint_path}")

            # --- Completion ---
            self.root.after(0, self._delete_completed, folder_name)

        except Exception as e:
            self.root.after(0, self._delete_failed, folder_name, str(e))

    def _delete_completed(self, folder_name):
        """删除完成时调用"""
        self.progress_var.set(100)  # Or 0, as progress isn't really tracked
        self.status_var.set(f"检查点 '{folder_name}' 已成功删除")
        messagebox.showinfo(
            "删除成功", f"检查点 '{folder_name}' 已被删除。", parent=self.root)
        # Refresh the list to show the updated state
        self.populate_checkpoint_list()
        # populate_checkpoint_list will call on_checkpoint_select, disabling buttons

    def _delete_failed(self, folder_name, error_msg):
        """删除失败时调用"""
        self.progress_var.set(0)
        self.status_var.set(f"删除 '{folder_name}' 失败: {error_msg[:100]}...")
        messagebox.showerror(
            "删除错误", f"删除检查点 '{folder_name}' 时发生错误: \n{error_msg}", parent=self.root)
        # Refresh the list anyway, in case the folder is partially deleted or state is inconsistent
        self.populate_checkpoint_list()
        # Re-enable buttons based on current selection state after refresh
        # self.on_checkpoint_select() # Called by populate_checkpoint_list


if __name__ == "__main__":
    root = tk.Tk()
    try:
        from ttkthemes import ThemedTk
        # Example themes: "arc", "plastik", "adapta", "ubuntu"
        root = ThemedTk(theme="arc")
    except ImportError:
        print("ttkthemes not found, using default Tk theme.")
        # Configure ttk styles for a slightly better default look if ttkthemes is missing
        style = ttk.Style()
        # print(style.theme_names()) # See available default themes
        try:
            # Try themes available on most platforms
            current_theme = style.theme_use()
            if 'vista' in style.theme_names():
                style.theme_use('vista')
            elif 'clam' in style.theme_names():
                style.theme_use('clam')
            elif 'alt' in style.theme_names():
                style.theme_use('alt')
            else:
                # Keep the default if none of the preferred ones are found
                style.theme_use(current_theme)
        except Exception as e:
            print(f"Could not set default ttk theme: {e}")
        pass  # Fallback to standard tk.Tk

    app = CheckpointApp(root)

    def on_closing():
        # Optional: Ask to save config before closing
        # if messagebox.askyesno("退出", "是否在退出前保存当前配置?", parent=root):
        #     app.save_config() # Ensure config reflects current UI state
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()
